import { BUILD_RELEASE_SHA } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
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

function acceptsHtml(request) {
  return request.headers.get('accept')?.includes('text/html') ?? false;
}

async function serveStaticOrSpa(request, env, url) {
  const assetResponse = await env.ASSETS.fetch(request);
  if (assetResponse.status !== 404) return assetResponse;

  if (!['GET', 'HEAD'].includes(request.method) || !acceptsHtml(request)) {
    return assetResponse;
  }

  const indexUrl = new URL('/index.html', url);
  const indexRequest = new Request(indexUrl, request);
  return env.ASSETS.fetch(indexRequest);
}

// Chief AI Worker entry point.
//
// Runtime routes always get first refusal. Static Assets serve real files only;
// browser navigation falls back to index.html here so provider-level SPA routing
// cannot swallow /version, /mcp, or /api/* before the Worker sees them.
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
      return handleProofModeMcp(request);
    }

    if (url.pathname === '/api/chief/capability-plan') {
      return handleChiefCapabilityPlan(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not implemented', { status: 501 });
    }

    return serveStaticOrSpa(request, env, url);
  },
};
