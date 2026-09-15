import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { getReleaseSha } from './fcr-service.js';
import { handleProofModeMcp } from './proofmode-mcp.js';

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

export default httpWorker;
