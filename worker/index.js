import { BUILD_RELEASE_BRANCH, BUILD_RELEASE_SHA } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { handleFederatedRelayV3BoundToRuntime } from './federated-relay-v3-runtime.js';
import { handleProofModeMcp } from './proofmode-mcp.js';
import { generateNonce, buildCspHeader } from './csp-policy.js';

const SECURITY_TXT = [
  'Contact: mailto:support@jussco.company',
  'Expires: 2027-06-30T00:00:00.000Z',
  'Preferred-Languages: en',
  'Canonical: https://chief-ai.cloudflare.app/.well-known/security.txt',
].join('\\n') + '\\n';

export function getReleaseSha(env, bakedOverride = BUILD_RELEASE_SHA) {
  const bakedReleaseSha = typeof bakedOverride === 'string'
    && bakedOverride.trim()
    && bakedOverride.trim() !== 'unknown'
    ? bakedOverride.trim()
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

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  const nonce = generateNonce();
  const csp = buildCspHeader(nonce, true);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set(csp.headerName, csp.value);
  return new Response(response.body, { ...response, headers });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/version') {
      return addSecurityHeaders(Response.json(
        {
          ok: true,
          sha: getReleaseSha(env),
          branch: getReleaseBranch(env),
          ...getProviderVersionMetadata(env),
        },
        { headers: { 'Cache-Control': 'no-store' } },
      ));
    }

    if (url.pathname === '/.well-known/security.txt') {
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return addSecurityHeaders(new Response(null, {
          status: 405,
          headers: { Allow: 'GET, HEAD', 'Cache-Control': 'no-store' },
        }));
      }
      return addSecurityHeaders(new Response(request.method === 'HEAD' ? null : SECURITY_TXT, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
        },
      }));
    }

    if (url.pathname === '/mcp') {
      const response = await handleProofModeMcp(request, env);
      return addSecurityHeaders(response);
    }

    if (url.pathname === '/api/chief/capability-plan') {
      const response = await handleChiefCapabilityPlan(request);
      return addSecurityHeaders(response);
    }

    if (url.pathname === '/api/chief/founder-content-proposal') {
      const response = await handleChiefFounderContentProposal(request);
      return addSecurityHeaders(response);
    }

    if (url.pathname === '/api/federated-relay/v3') {
      const response = await handleFederatedRelayV3BoundToRuntime(
        request,
        env,
        getReleaseSha(env),
        getReleaseBranch(env),
      );
      return addSecurityHeaders(response);
    }

    if (url.pathname === '/api/federated-relay') {
      return addSecurityHeaders(Response.json(
        {
          error: 'relay_v1_retired',
          successor: '/api/federated-relay/v3',
          executionAuthorized: false,
          authorityTransferred: false,
          approvalCarriedForward: false,
        },
        { status: 410, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } },
      ));
    }

    if (url.pathname.startsWith('/api/')) {
      return addSecurityHeaders(new Response('Not implemented', { status: 501 }));
    }

    // Route /app to the app.html (authenticated founder application)
    if (url.pathname === '/app' || url.pathname === '/app/') {
      const appRequest = new Request(new URL('/app.html', url), request);
      const response = await env.ASSETS.fetch(appRequest);
      return addSecurityHeaders(response);
    }

    const response = await env.ASSETS.fetch(request);
    return addSecurityHeaders(response);
  },
};
