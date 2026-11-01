import { describe, expect, it } from 'vitest';

import worker from './index.js';
import { handleProofModeMcp } from './proofmode-mcp.js';

const noAssets = {
  ASSETS: {
    fetch: () => {
      throw new Error('discovery paths must not fall through to the SPA');
    },
  },
};

describe('agent discovery surface', () => {
  it('serves an MCP server card that matches what /mcp actually lists', async () => {
    const cardResponse = await worker.fetch(
      new Request('https://chief-ai.example/.well-known/mcp/server-card.json'),
      noAssets,
    );
    expect(cardResponse.status).toBe(200);
    expect(cardResponse.headers.get('content-type')).toContain('application/json');
    const card = await cardResponse.json();
    expect(card.transport).toEqual({ type: 'streamable-http', url: 'https://chief-ai.example/mcp' });
    expect(card.authentication).toEqual({ required: false });

    const listResponse = await handleProofModeMcp(
      new Request('https://chief-ai.example/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      }),
    );
    const { result } = await listResponse.json();
    expect(card.tools.map((t) => t.name)).toEqual(result.tools.map((t) => t.name));
    expect(card.tools[0].inputSchema).toEqual(result.tools[0].inputSchema);

    const initResponse = await handleProofModeMcp(
      new Request('https://chief-ai.example/mcp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {} }),
      }),
    );
    const init = await initResponse.json();
    expect(card.serverInfo).toEqual(init.result.serverInfo);
  });

  it.each([
    '/.well-known/api-catalog',
    '/.well-known/agent-card.json',
    '/.well-known/oauth-protected-resource',
    '/.well-known/openid-configuration',
    '/auth.md',
  ])('returns an honest 404 for unimplemented discovery path %s', async (path) => {
    const response = await worker.fetch(new Request(`https://chief-ai.example${path}`), noAssets);
    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).not.toContain('text/html');
  });

  it('still hands ordinary SPA routes to assets', async () => {
    const response = await worker.fetch(new Request('https://chief-ai.example/some/route'), {
      ASSETS: { fetch: () => new Response('<html></html>', { status: 200 }) },
    });
    expect(response.status).toBe(200);
  });
});
