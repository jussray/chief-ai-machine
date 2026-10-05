import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefControlRoomRecommendation } from './chief-control-room-recommendation.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { getReleaseSha } from './fcr-service.js';
import { handleProofModeMcp } from './proofmode-mcp.js';
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
  return request.headers.get('authorization') === `Bearer ${token}`;
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
      prompt: `Return exactly ${RUNTIME_PROOF_MARKER} and nothing else.`,
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

// Runtime-neutral HTTP Worker surface.
//
// Keep this module free of `cloudflare:workers` imports so Node/Vitest contract
// tests can exercise /version and HTTP routing without pretending to provide a
// Cloudflare RPC runtime. The Cloudflare composition root in worker/index.js
// owns named WorkerEntrypoint exports.
const httpWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/version') {
      return Response.json(
        { ok: true, sha: getReleaseSha(env) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

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

    if (url.pathname === '/api/chief/capability-plan') {
      return handleChiefCapabilityPlan(request);
    }

    if (url.pathname === '/api/chief/control-room-recommendation') {
      return handleChiefControlRoomRecommendation(request);
    }

    if (url.pathname === '/api/chief/founder-content-proposal') {
      return handleChiefFounderContentProposal(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not implemented', { status: 501 });
    }

    return env.ASSETS.fetch(request);
  },
};

export default httpWorker;
