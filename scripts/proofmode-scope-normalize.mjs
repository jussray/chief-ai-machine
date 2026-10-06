import { readFileSync } from 'node:fs';

const mode = process.argv[2];
const raw = readFileSync(0, 'utf8').replace(/\r\n/g, '\n');

if (mode === 'wrangler') {
  const config = JSON.parse(raw);
  if (Array.isArray(config?.assets?.run_worker_first)) {
    config.assets.run_worker_first = config.assets.run_worker_first.filter(
      (route) => route !== '/github/*',
    );
  }
  process.stdout.write(JSON.stringify(config));
  process.exit(0);
}

if (mode === 'http-worker') {
  const boundedProviderProofHelpers = `import { chiefProviderStates, invokeChiefProvider } from './provider-runtime.js';

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

`;

  const boundedProviderProofRoutes = `
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
`;

  let normalized = raw;

  if (normalized.includes(boundedProviderProofHelpers)) {
    normalized = normalized.replace(boundedProviderProofHelpers, '');
  }

  if (normalized.includes(boundedProviderProofRoutes)) {
    normalized = normalized.replace(boundedProviderProofRoutes, '');
  }

  const lines = normalized.split('\n');
  const output = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line === "import { handleGitHubAppRequest } from './github-app.js';") {
      continue;
    }

    const isGithubRoute = line === "    if (url.pathname.startsWith('/github/')) {"
      && lines[index + 1] === '      return handleGitHubAppRequest(request, env);'
      && lines[index + 2] === '    }';
    if (isGithubRoute) {
      index += 2;
      continue;
    }

    output.push(line);
  }

  process.stdout.write(output.join('\n').replace(/\n{3,}/g, '\n\n'));
  process.exit(0);
}

throw new Error(`Unsupported ProofMode scope normalization mode: ${mode || '<empty>'}`);
