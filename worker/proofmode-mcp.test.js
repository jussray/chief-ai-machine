import { describe, expect, it } from 'vitest';
import { handleProofModeMcp } from './proofmode-mcp.js';

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
  });

  it('lists only the read-only repository audit tool', async () => {
    const response = await handleProofModeMcp(
      mcpRequest({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    );

    const payload = await json(response);
    expect(payload.result.tools).toHaveLength(1);
    expect(payload.result.tools[0].name).toBe('audit_repository');
    expect(payload.result.tools[0].inputSchema.required).toEqual(['owner', 'repo']);
  });

  it('calls the audit tool without mutation capability', async () => {
    const evidence = {
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

    const deps = {
      loadPublicRepositoryEvidence: async ({ owner, repo, ref }) => {
        expect(owner).toBe('acme');
        expect(repo).toBe('app');
        expect(ref).toBeUndefined();
        return evidence;
      },
      classifyRepositoryEvidence: (input) => ({
        repository: `${input.owner}/${input.repo}`,
        readiness: 'repository_supported_runtime_unverified',
      }),
    };

    const response = await handleProofModeMcp(
      mcpRequest({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'audit_repository', arguments: { owner: 'acme', repo: 'app' } },
      }),
      deps,
    );

    const payload = await json(response);
    expect(payload.result.isError).toBe(false);
    expect(payload.result.structuredContent.repository).toBe('acme/app');
  });

  it('rejects browser cross-origin requests', async () => {
    const response = await handleProofModeMcp(
      mcpRequest(
        { jsonrpc: '2.0', id: 4, method: 'tools/list' },
        { Origin: 'https://attacker.example' },
      ),
    );

    expect(response.status).toBe(403);
  });
});