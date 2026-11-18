import { BUILD_RELEASE_BRANCH } from './release-sha.js';
import { handleFederatedRelayV31Runtime } from './federated-relay-v31-runtime.js';
import { handleGitHubAppRequest } from './github-app.js';
import { makeRelayFetch } from './relay-fetch.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefControlRoomRecommendation } from './chief-control-room-recommendation.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { handleChiefProviderRoute, verifyRuntimeBearer } from './chief-provider-route.js';
import { getReleaseSha, getArtifactReleaseSha } from './fcr-service.js';
import { handleChiefMcp } from './chief-mcp.js';
import { chiefProviderStates, invokeChiefProvider } from './provider-runtime.js';

export function getReleaseBranch(env, bakedReleaseBranch = BUILD_RELEASE_BRANCH) {
  const candidates = [env?.FEDERATED_RELAY_BRANCH, env?.WORKERS_CI_BRANCH, bakedReleaseBranch];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return value?.trim() || 'unknown';
}

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

async function handleRuntimeProof(request, env) {
  if (request.method !== 'POST') {
    return Response.json({ ok: false, error: 'method_not_allowed' }, { status: 405 });
  }

  if (!(await verifyRuntimeBearer(request, env?.CHIEF_RUNTIME_PROOF_TOKEN))) {
    return Response.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const releaseSha = getArtifactReleaseSha();
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

    // Public RFC 9116 discovery must never be the SPA's HTML fallback.
    if (url.pathname === '/.well-known/security.txt') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method not allowed', {
          status: 405,
          headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
        });
      }

      const asset = await env.ASSETS.fetch(request);
      const contentType = asset.headers.get('content-type')?.toLowerCase() || '';
      if (!asset.ok || !contentType.startsWith('text/plain')) {
        return new Response('Security disclosure unavailable', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }
      return asset;
    }

    if (url.pathname === '/version') {
      return Response.json(
        { ok: true, sha: getReleaseSha(env), branch: getReleaseBranch(env) },
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

    if (url.pathname.startsWith('/github/')) {
      return handleGitHubAppRequest(request, env);
    }

    if (url.pathname === '/mcp') {
      return handleChiefMcp(request, env);
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

    if (url.pathname === '/api/chief/provider') {
      return handleChiefProviderRoute(request, env);
    }

    if (url.pathname === '/api/federated-relay') {
      return handleFederatedRelayV31Runtime(
        request,
        {
          ...env,
          RELEASE_SHA: getReleaseSha(env),
          FEDERATED_RELAY_BRANCH: getReleaseBranch(env),
        },
        makeRelayFetch(env),
      );
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not implemented', { status: 501 });
    }

    return env.ASSETS.fetch(request);
  },
};

export default httpWorker;
