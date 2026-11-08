import { BUILD_RELEASE_BRANCH } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefControlRoomRecommendation } from './chief-control-room-recommendation.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { handleFederatedRelayV31Runtime } from './federated-relay-v31-runtime.js';
import { getReleaseSha } from './fcr-service.js';
import { handleChiefMcp } from './chief-mcp.js';
import { handleGitHubAppRequest } from './github-app.js';
import { makeRelayFetch } from './relay-fetch.js';

export function getReleaseBranch(env, bakedReleaseBranch = BUILD_RELEASE_BRANCH) {
  const candidates = [env?.FEDERATED_RELAY_BRANCH, env?.WORKERS_CI_BRANCH, bakedReleaseBranch];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return value?.trim() || 'unknown';
}

const httpWorker = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/version') {
      return Response.json(
        { ok: true, sha: getReleaseSha(env), branch: getReleaseBranch(env) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    if (url.pathname === '/mcp') {
      return handleChiefMcp(request, env);
    }

    if (url.pathname.startsWith('/github/')) {
      return handleGitHubAppRequest(request, env);
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
