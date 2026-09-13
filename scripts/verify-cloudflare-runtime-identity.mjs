import { appendFile } from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN?.trim();
const repository = process.env.GITHUB_REPOSITORY?.trim();
const expectedHeadSha = process.env.EXPECTED_HEAD_SHA?.trim();
const explicitBaseUrl = process.env.CLOUDFLARE_RUNTIME_BASE_URL?.trim();
const checkName = process.env.CLOUDFLARE_CHECK_NAME?.trim() || 'Workers Builds: chief-ai';
const accessClientId = process.env.CLOUDFLARE_ACCESS_CLIENT_ID?.trim();
const accessClientSecret = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET?.trim();
const maxAttempts = Number.parseInt(process.env.CLOUDFLARE_RUNTIME_PROOF_ATTEMPTS || '30', 10);
const sleepMs = Number.parseInt(process.env.CLOUDFLARE_RUNTIME_PROOF_SLEEP_MS || '2000', 10);

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!token) fail('GITHUB_TOKEN is required to bind runtime identity to an exact-head provider check.');
if (!repository) fail('GITHUB_REPOSITORY is required.');
if (!expectedHeadSha) fail('EXPECTED_HEAD_SHA is required.');
if (!Number.isFinite(maxAttempts) || maxAttempts < 1) fail('CLOUDFLARE_RUNTIME_PROOF_ATTEMPTS must be a positive integer.');
if (!Number.isFinite(sleepMs) || sleepMs < 0) fail('CLOUDFLARE_RUNTIME_PROOF_SLEEP_MS must be a non-negative integer.');
if (Boolean(accessClientId) !== Boolean(accessClientSecret)) {
  fail('Cloudflare Access service auth is incomplete; client id and client secret must be configured together.');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchCheckRuns() {
  const url = `https://api.github.com/repos/${repository}/commits/${expectedHeadSha}/check-runs`;
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub check-runs read failed with HTTP ${response.status}.`);
  }
  return response.json();
}

function extractProviderIdentity(data) {
  const run = (data.check_runs || []).find((item) =>
    item.name === checkName
    && item.status === 'completed'
    && item.conclusion === 'success'
    && item.head_sha === expectedHeadSha
    && item.app?.slug === 'cloudflare-workers-and-pages');

  if (!run) return null;
  const summary = String(run.output?.summary || '');
  const versionId = summary.match(/Version ID:\s*([A-Za-z0-9-]+)/)?.[1] || null;
  const previewUrl = summary.match(/Preview URL:\s*(https:\/\/\S+)/)?.[1] || null;
  if (!versionId) {
    throw new Error(`Successful ${checkName} check did not expose a provider Version ID.`);
  }
  return { versionId, previewUrl };
}

let providerIdentity = null;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    providerIdentity = extractProviderIdentity(await fetchCheckRuns());
  } catch (error) {
    if (attempt === maxAttempts) fail(error instanceof Error ? error.message : String(error));
  }
  if (providerIdentity) break;
  if (attempt < maxAttempts) await sleep(sleepMs);
}

if (!providerIdentity) {
  fail(`No successful ${checkName} provider check with Version ID found for exact head ${expectedHeadSha}.`);
}

const runtimeBaseUrl = explicitBaseUrl || providerIdentity.previewUrl;
if (!runtimeBaseUrl) {
  fail(`No runtime URL is available for provider Version ID ${providerIdentity.versionId}.`);
}

let parsedRuntimeUrl;
try {
  parsedRuntimeUrl = new URL(runtimeBaseUrl);
} catch {
  fail('Cloudflare runtime URL is invalid.');
}
if (parsedRuntimeUrl.protocol !== 'https:') fail('Cloudflare runtime proof requires HTTPS.');

const headers = { Accept: 'application/json' };
if (accessClientId && accessClientSecret) {
  headers['CF-Access-Client-Id'] = accessClientId;
  headers['CF-Access-Client-Secret'] = accessClientSecret;
}

let lastStatus = 0;
let lastObservedVersionId = null;
let lastRedirectHost = null;
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  try {
    const response = await fetch(new URL('/version', parsedRuntimeUrl), {
      headers,
      redirect: 'manual',
    });
    lastStatus = response.status;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        try { lastRedirectHost = new URL(location, parsedRuntimeUrl).host; } catch { lastRedirectHost = null; }
      }
    } else {
      const body = await response.text();
      try {
        const parsed = JSON.parse(body);
        lastObservedVersionId = typeof parsed.version_id === 'string' ? parsed.version_id : null;
      } catch {
        lastObservedVersionId = null;
      }
      if (response.status === 200 && lastObservedVersionId === providerIdentity.versionId) {
        console.log(`Cloudflare runtime identity verified for exact head ${expectedHeadSha}.`);
        console.log(`Provider Version ID: ${providerIdentity.versionId}`);
        console.log(`Runtime: ${parsedRuntimeUrl.origin}`);
        if (process.env.GITHUB_ENV) {
          await appendFile(process.env.GITHUB_ENV, `CLOUDFLARE_RUNTIME_BASE_URL=${parsedRuntimeUrl.origin}\n`, 'utf8');
          await appendFile(process.env.GITHUB_ENV, `EXPECTED_CLOUDFLARE_VERSION_ID=${providerIdentity.versionId}\n`, 'utf8');
        }
        process.exit(0);
      }
    }
  } catch {
    // Retry boundedly; the final receipt below remains explicit.
  }
  if (attempt < maxAttempts) await sleep(sleepMs);
}

console.error(`Cloudflare runtime identity did not match provider Version ID for exact head ${expectedHeadSha}.`);
console.error(`Expected provider Version ID: ${providerIdentity.versionId}`);
console.error(`Observed provider Version ID: ${lastObservedVersionId || 'missing'}`);
console.error(`Observed HTTP status: ${lastStatus || 'unavailable'}`);
if (lastRedirectHost) console.error(`Observed redirect host: ${lastRedirectHost}`);
process.exit(1);
