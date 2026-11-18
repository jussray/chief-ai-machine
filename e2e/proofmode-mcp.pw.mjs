import { expect, test as base } from '@playwright/test';
import { chiefAccessHeaders, createChiefBoundRequest } from '../scripts/chief-proof-request.mjs';

const baseURL = process.env.PROOFMODE_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;

if (!baseURL) throw new Error('PROOFMODE_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');

// Chief's Worker origins sit behind Cloudflare Access. The constrained request
// fixture attaches the service-token pair (when CI provides one) only to the
// approved Chief origin, and never follows a redirect into the Access login page.
const test = base.extend({
  request: async ({ playwright }, use) => {
    const client = await playwright.request.newContext({
      extraHTTPHeaders: chiefAccessHeaders(process.env, baseURL),
    });
    await use(createChiefBoundRequest(client, baseURL));
    await client.dispose();
  },
});

async function postMcp(request, message) {
  return request.post(`${baseURL}/mcp`, {
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
    },
    data: message,
  });
}

test.describe('ProofMode live MCP runtime', () => {
  test('serves the exact branch head from /version', async ({ request }) => {
    const response = await request.get(`${baseURL}/version`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toEqual(expect.objectContaining({ ok: true, sha: expectedHead }));
    expect(body.version_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  test('initializes the MCP transport and advertises tools', async ({ request }) => {
    const response = await postMcp(request, {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'chief-ai-playwright-proof', version: '1.0.0' },
      },
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.protocolVersion).toBe('2025-06-18');
    expect(payload.result.serverInfo.name).toBe('proofmode');
    expect(payload.result.capabilities.tools).toEqual({ listChanged: false });
  });

  test('lists only read-only tools, including the audit_repository tool', async ({ request }) => {
    const response = await postMcp(request, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    // Same tool set as the unit contract in worker/proofmode-mcp.test.js.
    expect(payload.result.tools.map((tool) => tool.name).sort())
      .toEqual(['audit_repository', 'customer_start', 'lookup_dependency_docs']);
    for (const tool of payload.result.tools) {
      expect(tool.annotations).toEqual(expect.objectContaining({ readOnlyHint: true, destructiveHint: false }));
      expect(tool.inputSchema.properties ?? {}).not.toHaveProperty('token');
    }
    const auditTool = payload.result.tools.find((tool) => tool.name === 'audit_repository');
    expect(auditTool.inputSchema.required).toEqual(['owner', 'repo']);
  });

  test('audits the exact public repository head without mutation capability', async ({ request }) => {
    const response = await postMcp(request, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'audit_repository',
        arguments: {
          owner: 'jussray',
          repo: 'chief-ai-machine',
          ref: expectedHead,
        },
      },
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.isError).toBe(false);
    expect(payload.result.structuredContent.repository).toBe('jussray/chief-ai-machine');
    expect(payload.result.structuredContent.headSha).toBe(expectedHead);
    expect(payload.result.structuredContent.layers.find((layer) => layer.layer === 'verified').state).toBe('not_proven');
  });
});
