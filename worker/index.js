import { BUILD_RELEASE_SHA } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { handleProofModeMcp } from './proofmode-mcp.js';

function getReleaseSha(env) {
  const candidates = [
    env?.RELEASE_SHA,
    env?.GITHUB_SHA,
    env?.WORKERS_CI_COMMIT_SHA,
    BUILD_RELEASE_SHA,
  ];
  const value = candidates.find((candidate) => typeof candidate === 'string' && candidate.trim());
  return value?.trim() || 'unknown';
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
        { ok: true, sha: getReleaseSha(env) },
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

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not implemented', { status: 501 });
    }

    return env.ASSETS.fetch(request);
  },
};
