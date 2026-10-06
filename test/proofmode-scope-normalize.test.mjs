import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { test } from 'vitest';

function normalize(mode, input) {
  const result = spawnSync(
    process.execPath,
    ['scripts/proofmode-scope-normalize.mjs', mode],
    { input, encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

test('wrangler normalization ignores only the bounded GitHub worker-first route', () => {
  const base = JSON.stringify({ assets: { run_worker_first: ['/api/*', '/version', '/mcp'] } });
  const githubOnly = JSON.stringify({ assets: { run_worker_first: ['/api/*', '/github/*', '/version', '/mcp'] } });
  assert.equal(normalize('wrangler', base), normalize('wrangler', githubOnly));

  const proofModeChanged = JSON.stringify({ assets: { run_worker_first: ['/api/*', '/github/*', '/version'] } });
  assert.notEqual(normalize('wrangler', base), normalize('wrangler', proofModeChanged));
});

test('http-worker normalization ignores only the exact GitHub App import and route block', () => {
  const base = `import { handleProofModeMcp } from './proofmode-mcp.js';\n\nconst httpWorker = {\n  async fetch(request, env) {\n    const url = new URL(request.url);\n\n    if (url.pathname === '/mcp') {\n      return handleProofModeMcp(request, env);\n    }\n\n    return env.ASSETS.fetch(request);\n  },\n};\n`;
  const githubOnly = `import { handleGitHubAppRequest } from './github-app.js';\nimport { handleProofModeMcp } from './proofmode-mcp.js';\n\nconst httpWorker = {\n  async fetch(request, env) {\n    const url = new URL(request.url);\n\n    if (url.pathname === '/mcp') {\n      return handleProofModeMcp(request, env);\n    }\n\n    if (url.pathname.startsWith('/github/')) {\n      return handleGitHubAppRequest(request, env);\n    }\n\n    return env.ASSETS.fetch(request);\n  },\n};\n`;
  assert.equal(normalize('http-worker', base), normalize('http-worker', githubOnly));

  const proofModeChanged = githubOnly.replace("url.pathname === '/mcp'", "url.pathname === '/mcp-v2'");
  assert.notEqual(normalize('http-worker', base), normalize('http-worker', proofModeChanged));
});


test('http-worker normalization ignores only the exact bounded provider-proof helpers and routes', () => {
  const base = `import { handleProofModeMcp } from './proofmode-mcp.js';

const httpWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/mcp') {
      return handleProofModeMcp(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
`;

  const providerOnly = `import { handleProofModeMcp } from './proofmode-mcp.js';
import { chiefProviderStates, invokeChiefProvider } from './provider-runtime.js';

const FULL_SHA = /^[0-9a-f]{40}$/i;
const RUNTIME_PROOF_MARKER = 'CHIEF_RUNTIME_PROOF_OK';

function publicProviderStates(env) {
  return Object.fromEntries(
    Object.entries(chiefProviderStates(env)).map(([provider, state]) => [provider, {
      state: state.state,
      model: state.model,
    }]),
  );
}

function runtimeProofAuthorized(request, env) {
  const token = typeof env?.CHIEF_RUNTIME_PROOF_TOKEN === 'string'
    ? env.CHIEF_RUNTIME_PROOF_TOKEN.trim()
    : '';
  if (!token) return false;
  return request.headers.get('authorization') === \`Bearer \${token}\`;
}

async function handleRuntimeProof(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  if (!runtimeProofAuthorized(request, env)) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const releaseSha = getReleaseSha(env);
  if (!FULL_SHA.test(releaseSha)) {
    return Response.json({ ok: false, error: 'release_identity_unavailable' }, { status: 503 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const provider = typeof body?.provider === 'string' ? body.provider.trim().toLowerCase() : '';
  const providers = chiefProviderStates(env);
  if (!provider || !providers[provider]) {
    return Response.json({ ok: false, error: 'unsupported_provider' }, { status: 400 });
  }
  if (providers[provider].state === 'ABSENT') {
    return Response.json({ ok: false, error: 'provider_not_configured' }, { status: 503 });
  }

  let result;
  try {
    result = await invokeChiefProvider(env, {
      provider,
      prompt: \`Return exactly \${RUNTIME_PROOF_MARKER} and nothing else.\`,
      sensitivity: 'standard',
    });
  } catch {
    return Response.json({ ok: false, error: 'provider_proof_failed' }, { status: 503 });
  }

  if (result.text.trim() !== RUNTIME_PROOF_MARKER) {
    return Response.json({ ok: false, error: 'provider_proof_marker_mismatch' }, { status: 502 });
  }

  return Response.json({
    ok: true,
    service: 'chief-ai',
    release_sha: releaseSha,
    provider: result.provider,
    model: result.model,
    response_id: result.responseId,
    evidence_ref: result.evidenceRef,
    provider_state: 'VERIFIED',
  }, { headers: { 'Cache-Control': 'no-store' } });
}

const httpWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/chief/runtime-identity') {
      return Response.json({
        ok: true,
        service: 'chief-ai',
        release_sha: getReleaseSha(env),
        providers: publicProviderStates(env),
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    if (url.pathname === '/api/chief/runtime-proof') {
      return handleRuntimeProof(request, env);
    }

    if (url.pathname === '/mcp') {
      return handleProofModeMcp(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
`;

  assert.equal(normalize('http-worker', base), normalize('http-worker', providerOnly));

  const proofModeChanged = providerOnly.replace("url.pathname === '/mcp'", "url.pathname === '/mcp-v2'");
  assert.notEqual(normalize('http-worker', base), normalize('http-worker', proofModeChanged));

  const providerHelperChanged = providerOnly.replace(
    "provider_state: 'VERIFIED'",
    "provider_state: 'DEGRADED'",
  );
  assert.notEqual(normalize('http-worker', base), normalize('http-worker', providerHelperChanged));
});
