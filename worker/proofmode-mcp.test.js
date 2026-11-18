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
    expect(payload.result.instructions).toContain('ProofMode is read-only');
    expect(payload.result.instructions).toContain('Customer 5W1H');
  });

  it('lists the read-only repository audit and documentation tools without credential inputs', async () => {
    const response = await handleProofModeMcp(
      mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    );

    const payload = await json(response);
    expect(payload.result.tools).toHaveLength(3);

    const auditTool = payload.result.tools.find(t => t.name === 'audit_repository');
    expect(auditTool).toBeDefined();
    expect(auditTool.inputSchema.required).toEqual(['owner', 'repo']);
    expect(auditTool.inputSchema.properties).not.toHaveProperty('token');

    const docsTool = payload.result.tools.find(t => t.name === 'lookup_dependency_docs');
    expect(docsTool).toBeDefined();
    expect(docsTool.inputSchema.required).toEqual(['libraryId', 'query']);
    expect(docsTool.inputSchema.properties).not.toHaveProperty('token');

    const customerStartTool = payload.result.tools.find(t => t.name === 'customer_start');
    expect(customerStartTool).toBeDefined();
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

  it('calls audit_repository without exposing Worker credentials to MCP', async () => {
    const evidence = evidenceFixture();
    const deps = {
      loadPublicRepositoryEvidence: async ({ owner, repo, ref, token }) => {
        expect(owner).toBe('acme');
        expect(repo).toBe('app');
        expect(ref).toBeUndefined();
        // Token is not passed to public MCP audits
        expect(token).toBeUndefined();
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
