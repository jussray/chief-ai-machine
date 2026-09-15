import { BUILD_RELEASE_BRANCH, BUILD_RELEASE_SHA } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { handleFederatedRelayV3BoundToRuntime } from './federated-relay-v3-runtime.js';
import { handleProofModeMcp } from './proofmode-mcp.js';

function getReleaseSha(env) {
  const bakedReleaseSha = typeof BUILD_RELEASE_SHA === 'string'
    && BUILD_RELEASE_SHA.trim()
    && BUILD_RELEASE_SHA.trim() !== 'unknown'
    ? BUILD_RELEASE_SHA.trim()
    : null;

  const candidates = [
    bakedReleaseSha,
    env?.WORKERS_CI_COMMIT_SHA,
    env?.GITHUB_SHA,
    env?.RELEASE_SHA,
  ];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return value?.trim() || 'unknown';
}

function getReleaseBranch(env) {
  const bakedReleaseBranch = typeof BUILD_RELEASE_BRANCH === 'string'
    && BUILD_RELEASE_BRANCH.trim()
    && BUILD_RELEASE_BRANCH.trim() !== 'unknown'
    ? BUILD_RELEASE_BRANCH.trim()
    : null;

  const candidates = [
    bakedReleaseBranch,
    env?.WORKERS_CI_BRANCH,
    env?.GITHUB_REF_NAME,
    env?.RELEASE_BRANCH,
  ];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return value?.trim() || 'unknown';
}

function getProviderVersionMetadata(env) {
  const metadata = env?.CF_VERSION_METADATA;
  const result = {
    version_id: null,
    version_tag: null,
  };
  if (typeof metadata?.id === 'string' && metadata.id.trim()) result.version_id = metadata.id.trim();
  if (typeof metadata?.tag === 'string' && metadata.tag.trim()) result.version_tag = metadata.tag.trim();
  return result;
}

// Chief AI Worker entry point.
//
// Serves the static SPA (index.html, styles/, src/) via the ASSETS binding.
// Runtime-first routes are declared in wrangler.jsonc so they cannot silently
// fall through to SPA assets.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/version') {
      return Response.json(
        {
          ok: true,
          sha: getReleaseSha(env),
          branch: getReleaseBranch(env),
          ...getProviderVersionMetadata(env),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (url.pathname === '/mcp') {
      return handleProofModeMcp(request, env);
    }

    if (url.pathname === '/api/chief/capability-plan') {
      return handleChiefCapabilityPlan(request);
    }

    if (url.pathname === '/api/chief/founder-content-proposal') {
      return handleChiefFounderContentProposal(request);
    }

    if (url.pathname === '/api/federated-relay/v3') {
      return handleFederatedRelayV3BoundToRuntime(
        request,
        env,
        getReleaseSha(env),
        getReleaseBranch(env),
      );
    }

    if (url.pathname === '/api/federated-relay') {
      return Response.json(
        {
          error: 'relay_v1_retired',
          successor: '/api/federated-relay/v3',
          executionAuthorized: false,
          authorityTransferred: false,
          approvalCarriedForward: false,
        },
        { status: 410, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
      );
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not implemented', { status: 501 });
    }

    return env.ASSETS.fetch(request);
  },
};
