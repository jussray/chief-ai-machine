import { BUILD_RELEASE_SHA } from './release-sha.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';
import { handleChiefFounderContentProposal } from './chief-founder-content-proposal.js';
import { buildProofModeServerCard, handleProofModeMcp } from './proofmode-mcp.js';
import { routeAgentRequest } from 'agents';
import { handleGitHubWebhook } from '../src/agents/GitHubWebhookRouter.js';

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

// Chief AI Worker entry point with Agents SDK integration.
//
// Routes:
// - /api/* → Chief capability/proposal APIs
// - /agents/* → Agents SDK (Durable Objects)
// - /webhook/github → GitHub event routing
// - Everything else → SPA static assets via ASSETS binding
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Version endpoint
    if (url.pathname === '/version') {
      return Response.json(
        { ok: true, sha: getReleaseSha(env) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }

    // MCP server
    if (url.pathname === '/mcp') {
      return handleProofModeMcp(request, env);
    }

    // Chief APIs
    if (url.pathname === '/api/chief/capability-plan') {
      return handleChiefCapabilityPlan(request);
    }

    if (url.pathname === '/api/chief/founder-content-proposal') {
      return handleChiefFounderContentProposal(request);
    }

    // Agents SDK routes
    if (url.pathname.startsWith('/agents/')) {
      return routeAgentRequest(request, env) ?? new Response('Agent not found', { status: 404 });
    }

    // GitHub webhook dispatcher
    if (url.pathname === '/webhook/github' && request.method === 'POST') {
      return handleGitHubWebhook(request, env);
    }

    // Well-known paths
    if (url.pathname === '/.well-known/mcp/server-card.json') {
      return Response.json(buildProofModeServerCard(url.origin), {
        headers: { 'Cache-Control': 'public, max-age=300' },
      });
    }

    // Discovery paths must 404 honestly.
    if (url.pathname.startsWith('/.well-known/') || url.pathname === '/auth.md') {
      return new Response('Not found', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Catch-all for unimplemented API routes
    if (url.pathname.startsWith('/api/')) {
      return new Response('Not implemented', { status: 501 });
    }

    // Static SPA assets
    return env.ASSETS.fetch(request);
  },
};
