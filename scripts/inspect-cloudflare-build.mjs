#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const accountId = process.env.CF_ACCOUNT_ID?.trim();
const apiToken = process.env.CF_API_TOKEN ?? '';
const buildUuid = process.env.CF_BUILD_UUID?.trim();
const expectedHeadSha = process.env.EXPECTED_HEAD_SHA?.trim();
const publicVersionUrl =
  process.env.CF_PUBLIC_VERSION_URL?.trim() ||
  'https://chief-ai.mcgill-raylene.workers.dev/version';
const receiptPath = 'test-results/cloudflare-build-diagnostic.json';
const apiBase = 'https://api.cloudflare.com/client/v4';

function redact(value) {
  let text = String(value ?? '');
  for (const secret of [apiToken]) {
    if (secret) text = text.split(secret).join('[REDACTED]');
  }

  return text
    .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
    .replace(
      /(token|secret|password|private[_ -]?key|api[_ -]?key)(\s*[:=]\s*)\S+/gi,
      '$1$2[REDACTED]',
    )
    .replace(/\b(?:sk|ghp|github_pat|xox[baprs])-[-A-Za-z0-9_]{12,}\b/g, '[REDACTED_TOKEN]')
    .slice(0, 4000);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function providerMessages(body) {
  return [
    ...(body?.errors ?? []).map((entry) => entry?.message),
    ...(body?.messages ?? []).map((entry) =>
      typeof entry === 'string' ? entry : entry?.message,
    ),
  ].filter(Boolean);
}

function classifyTokenShape(token) {
  if (!token) {
    return {
      credentialType: 'missing',
      matchesAccountId: false,
      hasBearerPrefix: false,
      hasWhitespace: false,
      hasLeadingOrTrailingWhitespace: false,
      hasNonAscii: false,
      hasWrappingQuote: false,
      looksLikeAssignment: false,
      headerSafe: false,
    };
  }
  const shape = {
    credentialType: token.startsWith('cfut_')
      ? 'user-token'
      : token.startsWith('cfat_')
        ? 'account-token'
        : token.startsWith('cfk_')
          ? 'global-key'
          : 'legacy-or-unknown',
    matchesAccountId: Boolean(accountId && token === accountId),
    hasBearerPrefix: /^Bearer\s+/i.test(token),
    hasWhitespace: /\s/.test(token),
    hasLeadingOrTrailingWhitespace: token !== token.trim(),
    hasNonAscii: /[^\x20-\x7E]/.test(token),
    hasWrappingQuote: /^(?:".*"|'.*')$/.test(token),
    looksLikeAssignment: /^[A-Za-z_][A-Za-z0-9_]*=/.test(token),
  };
  return {
    ...shape,
    headerSafe: !shape.matchesAccountId
      && !shape.hasBearerPrefix
      && !shape.hasWhitespace
      && !shape.hasNonAscii
      && !shape.hasWrappingQuote
      && !shape.looksLikeAssignment,
  };
}

function tokenPreflightError(shape) {
  if (shape.matchesAccountId) {
    return {
      classification: 'provider-token-account-id',
      message: 'CLOUDFLARE_TOKEN_PREFLIGHT_FAILED: configured token equals the Cloudflare account ID.',
    };
  }
  if (shape.hasNonAscii) {
    return {
      classification: 'provider-token-header-unsafe',
      message: 'CLOUDFLARE_TOKEN_PREFLIGHT_FAILED: configured token contains non-ASCII characters and cannot be used as an HTTP Authorization value.',
    };
  }
  if (shape.hasBearerPrefix) {
    return {
      classification: 'provider-token-header-unsafe',
      message: 'CLOUDFLARE_TOKEN_PREFLIGHT_FAILED: configured token includes a Bearer prefix; store only the token value.',
    };
  }
  if (shape.hasWhitespace) {
    return {
      classification: 'provider-token-header-unsafe',
      message: 'CLOUDFLARE_TOKEN_PREFLIGHT_FAILED: configured token contains whitespace.',
    };
  }
  if (shape.hasWrappingQuote) {
    return {
      classification: 'provider-token-header-unsafe',
      message: 'CLOUDFLARE_TOKEN_PREFLIGHT_FAILED: configured token is wrapped in quotes.',
    };
  }
  if (shape.looksLikeAssignment) {
    return {
      classification: 'provider-token-header-unsafe',
      message: 'CLOUDFLARE_TOKEN_PREFLIGHT_FAILED: configured token looks like a variable assignment rather than a token value.',
    };
  }
  if (shape.credentialType === 'account-token') {
    return {
      classification: 'provider-token-type-unsupported',
      message: 'CLOUDFLARE_TOKEN_PREFLIGHT_FAILED: Workers Builds inspection requires a user-scoped Cloudflare API token; account-scoped tokens are unsupported.',
    };
  }
  if (shape.credentialType === 'global-key') {
    return {
      classification: 'provider-token-type-unsupported',
      message: 'CLOUDFLARE_TOKEN_PREFLIGHT_FAILED: Workers Builds inspection requires a user-scoped Cloudflare API token; a global API key is unsupported.',
    };
  }
  return null;
}

async function cloudflare(path) {
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(
      `Cloudflare API ${response.status}: ${redact(providerMessages(body).join('; ') || 'request failed')}`,
    );
  }
  return body?.result;
}

async function verifyUserToken() {
  const response = await fetch(`${apiBase}/user/tokens/verify`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });
  const body = await response.json().catch(() => null);
  const status = typeof body?.result?.status === 'string' ? body.result.status : null;
  const error = redact(providerMessages(body).join('; '));
  return {
    ok: response.ok && body?.success === true && status === 'active',
    httpStatus: response.status,
    status,
    error: error || null,
  };
}

function normalizeLogLine(line) {
  if (Array.isArray(line)) return line.map((part) => String(part)).join(' ');
  return String(line ?? '');
}

async function fetchAllBuildLogs() {
  const lines = [];
  let cursor = null;
  let truncated = false;

  for (let page = 0; page < 20; page += 1) {
    const suffix = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
    const result = await cloudflare(
      `/accounts/${accountId}/builds/builds/${buildUuid}/logs${suffix}`,
    );
    for (const line of result?.lines ?? []) lines.push(normalizeLogLine(line));
    truncated = result?.truncated === true;
    cursor = typeof result?.cursor === 'string' && result.cursor ? result.cursor : null;
    if (!truncated || !cursor) break;
  }

  return { lines, truncated };
}

function classifyFailure(lines) {
  const text = lines.join('\n');
  if (/invalid token|unauthori[sz]ed|forbidden|permission denied|\b401\b|\b403\b/i.test(text)) {
    return 'provider-auth';
  }
  if (/build minutes|quota|rate limit|limit exceeded|too many requests/i.test(text)) {
    return 'provider-limit';
  }
  if (/too many files|asset.*limit|asset.*size|maximum.*asset|static asset/i.test(text)) {
    return 'static-assets';
  }
  if (/npm ERR|npm error|npm ci.*fail|dependency.*fail|EAI_AGAIN|ENOTFOUND/i.test(text)) {
    return 'dependency-install';
  }
  if (/wrangler.*(error|fail)|deploy.*(error|fail)|versions upload.*(error|fail)/i.test(text)) {
    return 'wrangler-deploy';
  }
  if (/git.*(error|fail)|clone.*(error|fail)|checkout.*(error|fail)/i.test(text)) {
    return 'source-checkout';
  }
  if (/command.*(error|fail)|process.*exit|exit code [1-9]/i.test(text)) {
    return 'build-command';
  }
  return 'provider-build-failure-unclassified';
}

const receipt = {
  ok: false,
  mode: 'read-only',
  expectedHeadSha: expectedHeadSha || null,
  buildUuid: buildUuid || null,
  inspectedAt: new Date().toISOString(),
  providerCredentials: {
    accountIdPresent: Boolean(accountId),
    apiTokenPresent: Boolean(apiToken),
    tokenShape: classifyTokenShape(apiToken),
    tokenVerification: null,
  },
  publicRuntime: null,
  build: null,
  trigger: null,
  classification: null,
  relevantLogLines: [],
  logsTruncated: false,
  error: null,
};

try {
  if (!expectedHeadSha || !/^[0-9a-f]{40}$/.test(expectedHeadSha)) {
    throw new Error('EXPECTED_HEAD_SHA must be an exact 40-character lowercase git SHA.');
  }
  if (!buildUuid) throw new Error('CF_BUILD_UUID is required.');

  try {
    const response = await fetch(publicVersionUrl, {
      headers: { Accept: 'application/json' },
      redirect: 'error',
    });
    const bytes = Buffer.from(await response.arrayBuffer());
    const text = bytes.toString('utf8');
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }

    const liveSha = typeof json?.sha === 'string' ? json.sha : null;
    receipt.publicRuntime = {
      url: publicVersionUrl,
      httpStatus: response.status,
      contentType: response.headers.get('content-type'),
      responseBytes: bytes.byteLength,
      responseSha256: sha256(bytes),
      sha: liveSha,
      exactHead: liveSha === expectedHeadSha,
    };
  } catch (error) {
    receipt.publicRuntime = {
      url: publicVersionUrl,
      error: redact(error instanceof Error ? error.message : error),
    };
  }

  if (!accountId || !apiToken) {
    throw new Error(
      'PROVIDER_CREDENTIALS_UNAVAILABLE: Cloudflare account ID and a Workers CI Read token are required.',
    );
  }

  const preflight = tokenPreflightError(receipt.providerCredentials.tokenShape);
  if (preflight) {
    receipt.classification = preflight.classification;
    throw new Error(preflight.message);
  }

  const tokenVerification = await verifyUserToken();
  receipt.providerCredentials.tokenVerification = tokenVerification;
  if (!tokenVerification.ok) {
    receipt.classification = 'provider-token-invalid';
    throw new Error(
      `CLOUDFLARE_USER_TOKEN_VERIFICATION_FAILED: HTTP ${tokenVerification.httpStatus}; status ${tokenVerification.status || 'unknown'}${tokenVerification.error ? `; ${tokenVerification.error}` : ''}`,
    );
  }

  const build = await cloudflare(
    `/accounts/${accountId}/builds/builds/${encodeURIComponent(buildUuid)}`,
  );
  const metadata = build?.build_trigger_metadata ?? {};

  if (build?.build_uuid !== buildUuid) {
    throw new Error(`Cloudflare returned unexpected build UUID ${build?.build_uuid || 'unknown'}.`);
  }
  if (metadata?.commit_hash !== expectedHeadSha) {
    throw new Error(
      `BUILD_HEAD_MISMATCH: Cloudflare build commit ${metadata?.commit_hash || 'unknown'} does not match expected ${expectedHeadSha}.`,
    );
  }

  const logResult = await fetchAllBuildLogs();
  const redactedLines = logResult.lines.map(redact);
  const relevant = redactedLines.filter((line) =>
    /error|fail|fatal|exception|permission|unauthor|forbidden|wrangler|deploy|npm|node|asset|limit|quota|clone|checkout|exit/i.test(
      line,
    ),
  );

  receipt.build = {
    buildUuid: build.build_uuid,
    outcome: build.build_outcome ?? null,
    createdOn: build.created_on ?? null,
    initializedOn: build.initializing_on ?? null,
    runningOn: build.running_on ?? null,
    stoppedOn: build.stopped_on ?? null,
    branch: metadata.branch ?? null,
    commitHash: metadata.commit_hash ?? null,
    commitMessage: metadata.commit_message ?? null,
    triggerSource: metadata.build_trigger_source ?? null,
    buildCommand: metadata.build_command ?? null,
    deployCommand: metadata.deploy_command ?? null,
    rootDirectory: metadata.root_directory ?? null,
    repoName: metadata.repo_name ?? null,
    triggerName: metadata.trigger_name ?? null,
    triggerUuid: metadata.trigger_uuid ?? null,
  };
  receipt.trigger = build?.trigger
    ? {
        triggerName: build.trigger.trigger_name ?? null,
        triggerUuid: build.trigger.trigger_uuid ?? null,
        buildCommand: build.trigger.build_command ?? null,
        deployCommand: build.trigger.deploy_command ?? null,
        rootDirectory: build.trigger.root_directory ?? null,
        branchIncludes: build.trigger.branch_includes ?? [],
        branchExcludes: build.trigger.branch_excludes ?? [],
        pathIncludes: build.trigger.path_includes ?? [],
        pathExcludes: build.trigger.path_excludes ?? [],
        buildCachingEnabled: build.trigger.build_caching_enabled ?? null,
        providerType: build.trigger.repo_connection?.provider_type ?? null,
        repoName: build.trigger.repo_connection?.repo_name ?? null,
      }
    : null;
  receipt.classification =
    build.build_outcome === 'success' ? 'build-succeeded' : classifyFailure(redactedLines);
  receipt.relevantLogLines = (relevant.length > 0 ? relevant : redactedLines.slice(-60)).slice(-120);
  receipt.logsTruncated = logResult.truncated;
  receipt.ok = true;
} catch (error) {
  receipt.error = redact(error instanceof Error ? error.message : error);
  if (!receipt.classification && /Authentication failed|invalid token|unauthori[sz]ed|forbidden/i.test(receipt.error)) {
    receipt.classification = 'provider-resource-auth';
  }
  console.error(receipt.error);
  process.exitCode = 1;
}

await mkdir('test-results', { recursive: true });
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
console.log(`Cloudflare diagnostic receipt: ${receiptPath}`);
