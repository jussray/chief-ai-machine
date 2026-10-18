import { expect, test } from '@playwright/test';

const baseURL = process.env.PROOFMODE_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;
const clientId = process.env.CHIEF_ACCESS_CLIENT_ID;
const clientSecret = process.env.CHIEF_ACCESS_CLIENT_SECRET;

if (!baseURL) throw new Error('PROOFMODE_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');
if (!clientId || !clientSecret) throw new Error('Protected Chief Access service identity is required for live MCP proof');

// Fail closed before attaching service credentials to any request destination.
const parsedBase = new URL(baseURL);
if (parsedBase.protocol !== 'https:' ||
  !(parsedBase.hostname === 'chief.foundercontrolroom.org' || parsedBase.hostname.endsWith('.chief.foundercontrolroom.org')) ||
  parsedBase.username || parsedBase.password || parsedBase.port ||
  parsedBase.pathname !== '/' || parsedBase.search || parsedBase.hash) {
  throw new Error('Live MCP proof URL must use an approved Chief HTTPS hostname');
}
const requestOrigin = parsedBase.origin;
const accessHeaders = {
  'CF-Access-Client-Id': clientId,
  'CF-Access-Client-Secret': clientSecret,
};

async function postMcp(request, message) {
  return request.post(`${requestOrigin}/mcp`, {
    maxRedirects: 0,
    headers: {
      ...accessHeaders,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
    },
    data: message,
  });
}

test.describe('ProofMode live MCP runtime', () => {
  test('serves the exact branch head from /version', async ({ request }) => {
    const response = await request.get(`${requestOrigin}/version`, { headers: accessHeaders, maxRedirects: 0 });
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sha: expectedHead });
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
    expect(payload.result.serverInfo.name).toBe('chief-ai-machine');
    expect(payload.result.capabilities.tools).toEqual({ listChanged: false });
  });

  test('lists Chief read-only tools including ProofMode auditing', async ({ request }) => {
    const response = await postMcp(request, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.tools.map((tool) => tool.name)).toEqual(['audit_repository', 'lookup_dependency_docs', 'compose_capability_plan']);
    for (const tool of payload.result.tools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
    }
    expect(payload.result.tools[0].name).toBe('audit_repository');
    expect(payload.result.tools[0].inputSchema.required).toEqual(['owner', 'repo']);
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
