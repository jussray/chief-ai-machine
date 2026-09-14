import { expect, test } from '@playwright/test';

const baseURL = process.env.PROOFMODE_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;
const modernProtocolVersion = '2026-07-28';

if (!baseURL) throw new Error('PROOFMODE_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');

function modernMeta() {
  return {
    'io.modelcontextprotocol/protocolVersion': modernProtocolVersion,
    'io.modelcontextprotocol/clientInfo': { name: 'chief-ai-playwright-proof', version: '1.0.0' },
    'io.modelcontextprotocol/clientCapabilities': {},
  };
}

async function postLegacyMcp(request, message) {
  return request.post(`${baseURL}/mcp`, {
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
    },
    data: message,
  });
}

async function postModernMcp(request, message, name) {
  return request.post(`${baseURL}/mcp`, {
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': modernProtocolVersion,
      'Mcp-Method': message.method,
      ...(name ? { 'Mcp-Name': name } : {}),
    },
    data: {
      ...message,
      params: {
        ...(message.params || {}),
        _meta: modernMeta(),
      },
    },
  });
}

test.describe('ProofMode live MCP runtime', () => {
  test('serves the exact branch head from /version', async ({ request }) => {
    const response = await request.get(`${baseURL}/version`);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sha: expectedHead });
  });

  test('preserves the legacy initialize path for older clients', async ({ request }) => {
    const response = await postLegacyMcp(request, {
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
    expect(payload.result).not.toHaveProperty('resultType');
  });

  test('discovers MCP 2026-07-28 without a handshake', async ({ request }) => {
    const response = await postModernMcp(request, {
      jsonrpc: '2.0',
      id: 'discover-modern',
      method: 'server/discover',
      params: {},
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.resultType).toBe('complete');
    expect(payload.result.supportedVersions).toEqual([modernProtocolVersion]);
    expect(payload.result.capabilities.tools).toEqual({ listChanged: false });
    expect(payload.result.ttlMs).toBe(0);
    expect(payload.result.cacheScope).toBe('private');
    expect(payload.result._meta['io.modelcontextprotocol/serverInfo']).toMatchObject({
      name: 'proofmode',
      version: '0.1.0',
    });
  });

  test('lists only the read-only audit_repository tool with modern cache hints', async ({ request }) => {
    const response = await postModernMcp(request, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.resultType).toBe('complete');
    expect(payload.result.tools).toHaveLength(1);
    expect(payload.result.tools[0].name).toBe('audit_repository');
    expect(payload.result.tools[0].inputSchema.required).toEqual(['owner', 'repo']);
    expect(payload.result.tools[0].inputSchema.properties).not.toHaveProperty('token');
    expect(payload.result.tools[0].annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true,
    });
    expect(payload.result.ttlMs).toBe(0);
    expect(payload.result.cacheScope).toBe('private');
  });

  test('rejects GET while advertising only POST', async ({ request }) => {
    const response = await request.get(`${baseURL}/mcp`);
    expect(response.status()).toBe(405);
    expect(response.headers().allow).toBe('POST');
  });

  test('audits the exact public repository head over stateless MCP without mutation capability', async ({ request }) => {
    const response = await postModernMcp(request, {
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
    }, 'audit_repository');

    expect(response.status()).toBe(200);
    const payload = await response.json();
    const result = payload.result.structuredContent;
    const receipt = result.proofReceipt;

    expect(payload.result.resultType).toBe('complete');
    expect(payload.result.isError).toBe(false);
    expect(result.repository).toBe('jussray/chief-ai-machine');
    expect(result.headSha).toBe(expectedHead);
    expect(result.layers.find((layer) => layer.layer === 'verified').state).toBe('not_proven');
    expect(receipt).toMatchObject({
      schema: 'juss-proof/v1',
      project: 'jussray/chief-ai-machine',
      operation: 'repository_evidence_audit',
      state: expect.stringMatching(/^(inferred|unknown)$/),
      exactTarget: {
        repository: 'jussray/chief-ai-machine',
        sha: expectedHead,
      },
    });
    expect(receipt.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'proofmode_layer',
          name: 'verified: not_proven',
          state: 'unknown',
        }),
      ]),
    );
  });

  test('fails closed before provider access when modern routing headers disagree', async ({ request }) => {
    const response = await request.post(`${baseURL}/mcp`, {
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': modernProtocolVersion,
        'Mcp-Method': 'tools/call',
        'Mcp-Name': 'wrong_tool',
      },
      data: {
        jsonrpc: '2.0',
        id: 'bad-route',
        method: 'tools/call',
        params: {
          name: 'audit_repository',
          arguments: { owner: 'jussray', repo: 'chief-ai-machine', ref: expectedHead },
          _meta: modernMeta(),
        },
      },
    });

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe(-32020);
  });

  test('fails closed when required modern request metadata is absent', async ({ request }) => {
    const response = await request.post(`${baseURL}/mcp`, {
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        'MCP-Protocol-Version': modernProtocolVersion,
        'Mcp-Method': 'tools/list',
      },
      data: {
        jsonrpc: '2.0',
        id: 'missing-meta',
        method: 'tools/list',
        params: {},
      },
    });

    expect(response.status()).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe(-32020);
  });
});
