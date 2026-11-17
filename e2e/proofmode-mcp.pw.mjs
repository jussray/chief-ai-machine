import { expect, test } from '@playwright/test';
import { createChiefBoundRequest, chiefAccessHeaders } from '../scripts/chief-proof-request.mjs';

const baseURL = process.env.PROOFMODE_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;

if (!baseURL) throw new Error('PROOFMODE_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');

function boundProofClient(request) {
  const accessHeaders = chiefAccessHeaders(process.env, baseURL);
  const send = async (method, url, options = {}) => {
    try {
      return await request[method](url, {
        ...options,
        headers: { ...(options.headers || {}), ...accessHeaders },
      });
    } catch {
      // Playwright transport errors can include credential-bearing request details.
      throw new Error('PROOFMODE_HTTP_REQUEST_FAILED');
    }
  };
  const client = {
    get: (url, options) => send('get', url, options),
    post: (url, options) => send('post', url, options),
  };
  return createChiefBoundRequest(client, baseURL);
}

async function readProofJson(response) {
  const status = response.status();
  if (status >= 300 && status < 400) {
    let redirectHost = '';
    try { redirectHost = new URL(response.headers().location || '').hostname; } catch { /* no location */ }
    if (redirectHost.endsWith('.cloudflareaccess.com')) {
      throw new Error('PROOFMODE_ACCESS_DENIED: approved Cloudflare Access CI credentials missing or rejected');
    }
    throw new Error('PROOFMODE_UNEXPECTED_REDIRECT');
  }
  expect(status).toBe(200);
  expect((response.headers()['content-type'] || '').toLowerCase()).toContain('application/json');
  return response.json();
}

async function postMcp(request, message) {
  return boundProofClient(request).post(`${baseURL}/mcp`, {
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
    const response = await boundProofClient(request).get(`${baseURL}/version`);
    const body = await readProofJson(response);
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

    const payload = await readProofJson(response);
    expect(payload.result.protocolVersion).toBe('2025-06-18');
    expect(payload.result.serverInfo.name).toBe('proofmode');
    expect(payload.result.capabilities.tools).toEqual({ listChanged: false });
  });

  test('lists only the read-only audit_repository tool', async ({ request }) => {
    const response = await postMcp(request, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    const payload = await readProofJson(response);
    expect(payload.result.tools).toHaveLength(1);
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

    const payload = await readProofJson(response);
    expect(payload.result.isError).toBe(false);
    expect(payload.result.structuredContent.repository).toBe('jussray/chief-ai-machine');
    expect(payload.result.structuredContent.headSha).toBe(expectedHead);
    expect(payload.result.structuredContent.layers.find((layer) => layer.layer === 'verified').state).toBe('not_proven');
  });
});
