import { describe, expect, it } from 'vitest';
import { handleProofModeMcp } from './proofmode-mcp.js';

const UPSTREAM_RECEIPT = '11111111-1111-4111-8111-111111111111';

function mcpRequest(body, headers = {}) {
  return new Request('https://proofmode.example/mcp', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function modernMcpRequest(method, params = {}, headers = {}, id = 100) {
  const body = {
    jsonrpc: '2.0',
    id,
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientCapabilities': {},
        'io.modelcontextprotocol/clientInfo': { name: 'proofmode-test', version: '1.0.0' },
      },
    },
  };
  return mcpRequest(body, {
    'MCP-Protocol-Version': '2026-07-28',
    'Mcp-Method': method,
    ...(method === 'tools/call' ? { 'Mcp-Name': params.name } : {}),
    ...headers,
  });
}

async function json(response) {
  return response.json();
}

function evidenceFixture() {
  return {
    owner: 'acme',
    repo: 'app',
    repositoryUrl: 'https://github.com/acme/app',
    defaultBranch: 'main',
    ref: 'main',
    headSha: '0123456789abcdef0123456789abcdef01234567',
    readme: '# App',
    paths: ['package.json', 'src/index.js', 'src/api.js', 'src/ui.js', 'test/app.test.js'],
    treeTruncated: false,
    workflows: [{ name: 'CI tests', conclusion: 'success', url: 'https://github.com/acme/app/actions/runs/1' }],
    deployments: [],
  };
}

function classifier(input) {
  return {
    repository: `${input.owner}/${input.repo}`,
    repositoryUrl: input.repositoryUrl,
    ref: input.ref,
    headSha: input.headSha,
    readiness: 'repository_supported_runtime_unverified',
    layers: [
      { layer: 'implemented', state: 'supported' },
      { layer: 'tested', state: 'supported' },
      { layer: 'verified', state: 'not_proven' },
    ],
    nextChecks: [],
    limitations: [],
  };
}

describe('ProofMode MCP transport', () => {
  it('initializes with the tools capability', async () => {
    const response = await handleProofModeMcp(
      mcpRequest({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      }),
    );

    expect(response.status).toBe(200);
    const payload = await json(response);
    expect(payload.result.protocolVersion).toBe('2025-06-18');
    expect(payload.result.capabilities.tools).toEqual({ listChanged: false });
    expect(payload.result.instructions).toContain('juss-proof/v1');
  });

  it('lists only the read-only repository audit tool without credential inputs', async () => {
    const response = await handleProofModeMcp(
      mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    );

    const payload = await json(response);
    expect(payload.result.tools).toHaveLength(1);
    expect(payload.result.tools[0].name).toBe('audit_repository');
    expect(payload.result.tools[0].inputSchema.required).toEqual(['owner', 'repo']);
    expect(payload.result.tools[0].inputSchema.properties).not.toHaveProperty('token');
    expect(payload.result.tools[0].annotations).toMatchObject({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    });
  });

  it('supports modern stateless discovery and cacheable tool listing', async () => {
    const discovered = await handleProofModeMcp(modernMcpRequest('server/discover'));
    const listed = await handleProofModeMcp(modernMcpRequest('tools/list'));

    expect(discovered.status).toBe(200);
    await expect(json(discovered)).resolves.toMatchObject({
      result: {
        resultType: 'complete',
        supportedVersions: expect.arrayContaining(['2026-07-28', '2025-11-25']),
        capabilities: { tools: {} },
        ttlMs: 300000,
        cacheScope: 'public',
      },
    });
    await expect(json(listed)).resolves.toMatchObject({
      result: {
        resultType: 'complete',
        ttlMs: 300000,
        cacheScope: 'public',
        tools: [{ name: 'audit_repository' }],
      },
    });
  });

  it('rejects modern header/body routing mismatches', async () => {
    const response = await handleProofModeMcp(
      modernMcpRequest('tools/list', {}, { 'Mcp-Method': 'tools/call' }),
    );
    expect(response.status).toBe(400);
    expect((await json(response)).error.code).toBe(-32020);
  });

  it('calls the audit tool without mutation capability and emits a federated receipt', async () => {
    const evidence = evidenceFixture();
    const deps = {
      loadPublicRepositoryEvidence: async ({ owner, repo, ref, token }) => {
        expect(owner).toBe('acme');
        expect(repo).toBe('app');
        expect(ref).toBeUndefined();
        expect(token).toBeUndefined();
        return evidence;
      },
      classifyRepositoryEvidence: classifier,
    };

    const response = await handleProofModeMcp(
      mcpRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'audit_repository',
          arguments: { owner: 'acme', repo: 'app', acknowledges: [UPSTREAM_RECEIPT] },
        },
      }),
      deps,
    );

    const payload = await json(response);
    expect(payload.result.isError).toBe(false);
    expect(payload.result.structuredContent.repository).toBe('acme/app');
    expect(payload.result.structuredContent.proofReceipt).toMatchObject({
      schema: 'juss-proof/v1',
      project: 'acme/app',
      actor: 'proofmode-github-mcp',
      authority: {
        provider: 'github',
        scope: 'repository',
        target: 'acme/app',
        mode: 'verify',
      },
      exactTarget: {
        repository: 'acme/app',
        branch: 'main',
        sha: evidence.headSha,
      },
      operation: 'repository_evidence_audit',
      state: 'inferred',
      acknowledges: [UPSTREAM_RECEIPT],
      dependsOn: [UPSTREAM_RECEIPT],
      nextAuthority: 'runtime-provider-mcp',
    });
    expect(payload.result.structuredContent.proofReceipt.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'repository_snapshot', state: 'verified' }),
        expect.objectContaining({ type: 'proofmode_layer', name: 'implemented: supported', state: 'verified' }),
        expect.objectContaining({ type: 'proofmode_layer', name: 'verified: not_proven', state: 'unknown' }),
      ]),
    );
  });

  it('forwards the Worker GitHub credential internally without exposing it to MCP callers', async () => {
    const evidence = evidenceFixture();
    const deps = {
      loadPublicRepositoryEvidence: async ({ owner, repo, token }) => {
        expect(owner).toBe('acme');
        expect(repo).toBe('app');
        expect(token).toBe('server-secret');
        return evidence;
      },
      classifyRepositoryEvidence: classifier,
    };

    const response = await handleProofModeMcp(
      mcpRequest({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: { name: 'audit_repository', arguments: { owner: 'acme', repo: 'app' } },
      }),
      { PROOFMODE_GITHUB_TOKEN: 'server-secret' },
      deps,
    );

    const payload = await json(response);
    expect(payload.result.isError).toBe(false);
    expect(payload.result.structuredContent.repository).toBe('acme/app');
  });

  it('rejects credential-shaped or otherwise unexpected arguments', async () => {
    const response = await handleProofModeMcp(mcpRequest({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'audit_repository',
        arguments: { owner: 'acme', repo: 'app', token: 'must-never-cross' },
      },
    }));

    expect(response.status).toBe(200);
    expect((await json(response)).error).toMatchObject({
      code: -32602,
      data: ['token'],
    });
  });

  it('rejects browser cross-origin requests', async () => {
    const response = await handleProofModeMcp(
      mcpRequest(
        { jsonrpc: '2.0', id: 5, method: 'tools/list' },
        { Origin: 'https://attacker.example' },
      ),
    );

    expect(response.status).toBe(403);
  });
});
