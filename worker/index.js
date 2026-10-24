import { BUILD_RELEASE_SHA } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { buildProofModeServerCard, handleProofModeMcp } from './proofmode-mcp.js';
import { generateNonce, buildCspHeader } from './csp-policy.js';

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

// Apply security headers to all responses
function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  const nonce = generateNonce();
  const csp = buildCspHeader(nonce, true); // report-only mode
  headers.set(csp.headerName, csp.value);

  // Additional security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
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

    if (url.pathname === '/.well-known/mcp/server-card.json') {
      return Response.json(buildProofModeServerCard(url.origin), {
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    // Discovery paths must 404 honestly. Without this, the SPA fallback
    // answers them with index.html + 200, which agents and scanners read as
    // a broken JSON document (or, for /auth.md, as a file that exists).
    if (url.pathname.startsWith('/.well-known/') || url.pathname === '/auth.md') {
      return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response('Not implemented', { status: 501 });
    }

    const response = await env.ASSETS.fetch(request);
    return addSecurityHeaders(response);
  },
};
