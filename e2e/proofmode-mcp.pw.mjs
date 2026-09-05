import { expect, test } from '@playwright/test';
import { createCapabilityRegistry } from '../src/domain/capability-registry.js';
import { sha256Hex } from '../src/domain/capability-plan.js';
import { createGoalPlan } from '../src/domain/goal-plan.js';

const baseURL = process.env.PROOFMODE_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;

if (!baseURL) throw new Error('PROOFMODE_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');

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

async function postModernMcp(request, message) {
  return request.post(`${baseURL}/mcp`, {
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2026-07-28',
      'Mcp-Method': message.method,
      ...(message.method === 'tools/call' ? { 'Mcp-Name': message.params.name } : {}),
    },
    data: message,
  });
}

function modernMessage(id, method, params = {}) {
  return {
    jsonrpc: '2.0',
    id,
    method,
    params: {
      ...params,
      _meta: {
        'io.modelcontextprotocol/protocolVersion': '2026-07-28',
        'io.modelcontextprotocol/clientCapabilities': {},
        'io.modelcontextprotocol/clientInfo': {
          name: 'chief-ai-playwright-proof',
          version: '1.0.0',
        },
      },
    },
  };
}

function proposalFixture() {
  const registrySnapshot = createCapabilityRegistry({
    registryId: 'chief-mcp-playwright-registry',
    version: '2026-09-05.1',
    approvedBy: 'playwright-fixture',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1.0.0',
      origin: 'repo-native',
      owner: 'jussray/chief-ai-machine',
      sourceHash: sha256Hex('goalfix-v1-chief-playwright'),
      authorityCeiling: 'reversible',
    }],
  });
  const goalPlan = createGoalPlan({
    goal: 'Prepare one bounded change for founder review',
    project: 'chief-ai-machine',
    definitionOfDone: 'Chief proposes the plan and execution remains disabled',
    strategicLenses: ['ooda', 'redteam'],
    capabilities: ['goalfix-v1'],
    proofRequirements: ['exact-head Playwright proof'],
    rollback: 'discard the proposal',
    nextGate: 'Founder Control Room verifies and resolves authority',
  });
  return {
    goalPlan,
    registrySnapshot,
    expectedHeadSha: expectedHead,
    requestedAuthority: 'reversible',
    connectionRequests: [{
      connectionType: 'github',
      environment: 'production',
      capabilities: ['inspect_repos'],
    }],
  };
}

test.describe('Chief live MCP runtime', () => {
  test('serves the exact branch head from /version', async ({ request }) => {
    const response = await request.get(`${baseURL}/version`);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sha: expectedHead });
  });

  test('initializes as Chief rather than its ProofMode subsystem', async ({ request }) => {
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
    expect(payload.result.serverInfo).toMatchObject({
      name: 'chief-ai-machine',
      title: 'Chief AI Machine',
    });
    expect(payload.result.capabilities.tools).toEqual({ listChanged: false });
    expect(payload.result.instructions).toContain('Founder Control Room remains the authority');
  });

  test('lists Chief cognition plus its non-authorizing evidence tools', async ({ request }) => {
    const response = await postMcp(request, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.tools).toHaveLength(3);
    expect(payload.result.tools.map((tool) => tool.name)).toEqual([
      'audit_repository',
      'lookup_dependency_docs',
      'compose_capability_plan',
    ]);
    for (const tool of payload.result.tools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.destructiveHint).toBe(false);
    }
  });

  test('serves the modern stateless MCP discovery contract under Chief identity', async ({ request }) => {
    const response = await postModernMcp(
      request,
      modernMessage(20, 'server/discover'),
    );

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.resultType).toBe('complete');
    expect(payload.result.supportedVersions).toContain('2026-07-28');
    expect(payload.result.capabilities).toEqual({ tools: {} });
    expect(payload.result.cacheScope).toBe('public');
    expect(payload.result.instructions).toContain('Chief composes bounded capability-plan proposals');
    expect(payload.result._meta['io.modelcontextprotocol/serverInfo']).toMatchObject({
      name: 'chief-ai-machine',
      title: 'Chief AI Machine',
    });
  });

  test('composes a real Chief capability plan without minting authority', async ({ request }) => {
    const response = await postModernMcp(
      request,
      modernMessage(22, 'tools/call', {
        name: 'compose_capability_plan',
        arguments: { proposal: proposalFixture() },
      }),
    );

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.isError).toBe(false);
    expect(payload.result.structuredContent).toMatchObject({
      schema: 'juss/chief-mcp-capability-proposal@v1',
      governanceBoundary: {
        proposalOnly: true,
        executionAuthorized: false,
        founderApprovalRequired: true,
        remoteFounderSurfacesMaySelfAuthorize: false,
        connectionResolutionAuthority: 'founder-control-room',
      },
      founderControl: {
        chiefMaySelfAuthorize: false,
        surfaceMaySelfAuthorize: false,
        executionAuthorized: false,
      },
      authority: {
        founderApprovalAuthority: false,
        executionAuthority: false,
        providerMutationAuthority: false,
        mergeAuthority: false,
        deployAuthority: false,
        publicationAuthority: false,
        outcomeVerificationAuthority: false,
        nextAuthority: 'founder-control-room',
      },
    });
    expect(payload.result.structuredContent.capabilityPlan.expectedHeadSha).toBe(expectedHead);
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

  test('looks up a real current TypeScript dependency through Context7 as non-authorizing evidence', async ({ request }) => {
    const response = await postModernMcp(
      request,
      modernMessage(21, 'tools/call', {
        name: 'lookup_dependency_docs',
        arguments: {
          libraryId: '/microsoft/typescript',
          query: 'For TypeScript compiler configuration, what does noEmit do while type checking?',
        },
      }),
    );

    expect(response.status()).toBe(200);
    const payload = await response.json();
    expect(payload.result.isError).toBe(false);
    expect(payload.result.structuredContent).toMatchObject({
      schema: 'chief-documentation-evidence/v1',
      provider: 'context7',
      source: 'https://mcp.context7.com/mcp',
      libraryId: '/microsoft/typescript',
      authority: {
        documentationOnly: true,
        actionAuthority: false,
        repositoryVerification: false,
        runtimeVerification: false,
        reviewAuthority: false,
        mergeAuthority: false,
        deployAuthority: false,
      },
    });
    expect(payload.result.structuredContent.queryFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(payload.result.structuredContent.contentFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(payload.result.structuredContent.documentation.length).toBeGreaterThan(40);
  });
});