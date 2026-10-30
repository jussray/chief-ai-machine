import { BUILD_RELEASE_SHA } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { buildProofModeServerCard, handleProofModeMcp } from './proofmode-mcp.js';
import { generateNonce, buildCspHeader } from './csp-policy.js';
import { verifyStripeWebhookSignature } from './stripe-webhook-verify.js';

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

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  const nonce = generateNonce();
  const csp = buildCspHeader(nonce, true);
  headers.set(csp.headerName, csp.value);
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

async function handleStripeWebhook(request, env) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: { Allow: 'POST' },
    });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  const verified = await verifyStripeWebhookSignature(
    body,
    signature,
    env?.STRIPE_WEBHOOK_SECRET,
  );

  if (!verified) {
    return Response.json(
      { ok: false, error: 'invalid_signature' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return Response.json(
    { ok: false, verified: true, error: 'event_processing_not_implemented' },
    {
      status: 501,
      headers: {
        'Cache-Control': 'no-store',
        'X-Chief-Stripe-Signature-Verified': 'true',
      },
    },
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response;

    if (url.pathname === '/version') {
      response = Response.json(
        { ok: true, sha: getReleaseSha(env) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } else if (url.pathname === '/mcp') {
      response = await handleProofModeMcp(request, env);
    } else if (url.pathname === '/api/chief/capability-plan') {
      response = await handleChiefCapabilityPlan(request);
    } else if (url.pathname === '/api/chief/founder-content-proposal') {
      response = await handleChiefFounderContentProposal(request);
    } else if (url.pathname === '/api/stripe-webhook') {
      response = await handleStripeWebhook(request, env);
    } else if (url.pathname === '/.well-known/security.txt' && url.hostname === 'chief-ai.cloudflare.app') {
      const policy = [
        'Contact: mailto:support@jussco.company',
        'Expires: 2027-06-30T00:00:00.000Z',
        'Preferred-Languages: en',
        'Canonical: https://chief-ai.cloudflare.app/.well-known/security.txt',
      ].join('\n') + '\n';
      response = request.method === 'GET' || request.method === 'HEAD'
        ? new Response(request.method === 'HEAD' ? null : policy, {
            headers: {
              'Content-Type': 'text/plain; charset=utf-8',
              'Cache-Control': 'public, max-age=300',
            },
          })
        : new Response('Method not allowed', {
            status: 405,
            headers: {
              Allow: 'GET, HEAD',
              'Content-Type': 'text/plain; charset=utf-8',
            },
          });
    } else if (url.pathname === '/.well-known/mcp/server-card.json') {
      response = Response.json(buildProofModeServerCard(url.origin), {
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    } else if (url.pathname.startsWith('/.well-known/') || url.pathname === '/auth.md') {
      response = new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } else if (url.pathname.startsWith('/api/')) {
      response = new Response('Not implemented', { status: 501 });
    } else {
      response = await env.ASSETS.fetch(request);
    }

    return addSecurityHeaders(response);
  },
};
