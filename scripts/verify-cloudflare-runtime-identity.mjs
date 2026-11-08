import { appendFile } from 'node:fs/promises';

const token = process.env.GITHUB_TOKEN?.trim();
const repository = process.env.GITHUB_REPOSITORY?.trim();
const expectedHeadSha = process.env.EXPECTED_HEAD_SHA?.trim();
const expectedHeadBranch = process.env.EXPECTED_HEAD_BRANCH?.trim();
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
if (!expectedHeadBranch) fail('EXPECTED_HEAD_BRANCH is required.');
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
  const previewAliasUrl = summary.match(/Preview Alias URL:\s*(https:\/\/\S+)/)?.[1] || null;
  if (!versionId) {
    throw new Error(`Successful ${checkName} check did not expose a provider Version ID.`);
  }
  return { versionId, previewUrl, previewAliasUrl };
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

const candidateBaseUrls = explicitBaseUrl
  ? [explicitBaseUrl]
  : [providerIdentity.previewAliasUrl, providerIdentity.previewUrl]
      .filter((value) => typeof value === 'string' && value.trim())
      .filter((value, index, values) => values.indexOf(value) === index);

if (candidateBaseUrls.length === 0) {
  fail(`No runtime URL is available for provider Version ID ${providerIdentity.versionId}.`);
}

const runtimeCandidates = candidateBaseUrls.map((runtimeBaseUrl) => {
  let parsed;
  try {
    parsed = new URL(runtimeBaseUrl);
  } catch {
    fail('Cloudflare runtime URL is invalid.');
  }
  if (parsed.protocol !== 'https:') fail('Cloudflare runtime proof requires HTTPS.');
  return parsed;
});

const headers = { Accept: 'application/json' };
if (accessClientId && accessClientSecret) {
  headers['CF-Access-Client-Id'] = accessClientId;
  headers['CF-Access-Client-Secret'] = accessClientSecret;
}

const observations = new Map();
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  for (const parsedRuntimeUrl of runtimeCandidates) {
    const observation = observations.get(parsedRuntimeUrl.origin) || {
      status: 0,
      versionId: null,
      sha: null,
      branch: null,
      redirectHost: null,
    };
    try {
      const response = await fetch(new URL('/version', parsedRuntimeUrl), {
        headers,
        redirect: 'manual',
      });
      observation.status = response.status;
      observation.redirectHost = null;
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (location) {
          try { observation.redirectHost = new URL(location, parsedRuntimeUrl).host; } catch { observation.redirectHost = null; }
        }
      } else {
        const body = await response.text();
        try {
          const parsed = JSON.parse(body);
          observation.versionId = typeof parsed.version_id === 'string' ? parsed.version_id : null;
          observation.sha = typeof parsed.sha === 'string' ? parsed.sha : null;
          observation.branch = typeof parsed.branch === 'string' ? parsed.branch : null;
        } catch {
          observation.versionId = null;
          observation.sha = null;
          observation.branch = null;
        }
        if (
          response.status === 200
          && observation.versionId === providerIdentity.versionId
          && observation.sha === expectedHeadSha
          && observation.branch === expectedHeadBranch
        ) {
          console.log(`Cloudflare runtime identity verified for exact head ${expectedHeadSha}.`);
          console.log(`Provider Version ID: ${providerIdentity.versionId}`);
          console.log(`Runtime branch: ${expectedHeadBranch}`);
          console.log(`Runtime: ${parsedRuntimeUrl.origin}`);
          if (process.env.GITHUB_ENV) {
            await appendFile(process.env.GITHUB_ENV, `CLOUDFLARE_RUNTIME_BASE_URL=${parsedRuntimeUrl.origin}\n`, 'utf8');
            await appendFile(process.env.GITHUB_ENV, `EXPECTED_CLOUDFLARE_VERSION_ID=${providerIdentity.versionId}\n`, 'utf8');
            await appendFile(process.env.GITHUB_ENV, `EXPECTED_RUNTIME_BRANCH=${expectedHeadBranch}\n`, 'utf8');
          }
          process.exit(0);
        }
      }
    } catch {
      // Retry boundedly; the final receipt below remains explicit.
    }
    observations.set(parsedRuntimeUrl.origin, observation);
  }
  if (attempt < maxAttempts) await sleep(sleepMs);
}

console.error(`Cloudflare runtime identity did not match provider Version ID + exact SHA + branch for ${expectedHeadSha}.`);
console.error(`Expected provider Version ID: ${providerIdentity.versionId}`);
console.error(`Expected runtime SHA: ${expectedHeadSha}`);
console.error(`Expected runtime branch: ${expectedHeadBranch}`);
for (const candidate of runtimeCandidates) {
  const observation = observations.get(candidate.origin) || {};
  console.error(`Candidate runtime: ${candidate.origin}`);
  console.error(`Observed provider Version ID: ${observation.versionId || 'missing'}`);
  console.error(`Observed runtime SHA: ${observation.sha || 'missing'}`);
  console.error(`Observed runtime branch: ${observation.branch || 'missing'}`);
  console.error(`Observed HTTP status: ${observation.status || 'unavailable'}`);
  if (observation.redirectHost) console.error(`Observed redirect host: ${observation.redirectHost}`);
}
process.exit(1);
