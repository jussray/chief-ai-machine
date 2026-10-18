import { describe, expect, it } from 'vitest';
import { createCapabilityRegistry } from '../src/domain/capability-registry.js';
import { sha256Hex } from '../src/domain/capability-plan.js';
import { createGoalPlan } from '../src/domain/goal-plan.js';
import { handleChiefMcp } from './chief-mcp.js';

const expectedHeadSha = '73c36e61dae96bf1bb94990d3b5e5a6a0bb70b24';

function registry() {
  return createCapabilityRegistry({
    registryId: 'chief-mcp-test-registry',
    version: '2026-09-05.1',
    approvedBy: 'founder-fixture',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1.0.0',
      origin: 'repo-native',
      owner: 'jussray/chief-ai-machine',
      sourceHash: sha256Hex('goalfix-v1-chief-mcp-fixture'),
      authorityCeiling: 'reversible',
    }],
  });
}

function goal(strategicLenses = ['ooda', 'redteam']) {
  return createGoalPlan({
    goal: 'Prepare one bounded implementation proposal for founder review',
    project: 'chief-ai-machine',
    definitionOfDone: 'Chief returns a deterministic proposal and no execution authority',
    strategicLenses,
    capabilities: ['goalfix-v1'],
    proofRequirements: ['exact-head source tests', 'Playwright runtime proof'],
    rollback: 'discard the proposal',
    nextGate: 'Founder Control Room resolves truth and founder authority',
  });
}

function legacyRequest(body) {
  return new Request('https://chief.example/mcp', {
    method: 'POST',
    headers: {
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
    },
    body: JSON.stringify(body),
  });
}

async function json(response) {
  return response.json();
}

describe('Chief MCP', () => {
  it('identifies as Chief rather than ProofMode', async () => {
    const response = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'chief-mcp-test', version: '1.0.0' },
      },
    }));

    expect(response.status).toBe(200);
    const payload = await json(response);
    expect(payload.result.serverInfo).toMatchObject({
      name: 'chief-ai-machine',
      title: 'Chief AI Machine',
    });
    expect(payload.result.instructions).toContain('Chief composes bounded capability-plan proposals');
    expect(payload.result.instructions).toContain('Founder Control Room remains the authority');
  });

  it('advertises Chief cognition alongside ProofMode evidence tools', async () => {
    const response = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    }));

    expect(response.status).toBe(200);
    const payload = await json(response);
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

  it('composes a proposal with server-owned ULTRATHINK but refuses to become its own authority', async () => {
    const snapshot = registry();
    const response = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'compose_capability_plan',
        arguments: {
          proposal: {
            goalPlan: goal(['/ultrathink', 'goalfix', 'caller-injected-mode']),
            registrySnapshot: snapshot,
            expectedHeadSha,
            requestedAuthority: 'reversible',
            connectionRequests: [{
              connectionType: 'github',
              environment: 'production',
              capabilities: ['inspect_repos'],
            }],
          },
        },
      },
    }));

    expect(response.status).toBe(200);
    const payload = await json(response);
    expect(payload.result.isError).toBe(false);
    expect(payload.result.structuredContent).toMatchObject({
      schema: 'juss/chief-mcp-capability-proposal@v1',
      reasoningPolicy: {
        contract: 'juss/chief-trusted-reasoning-policy@v1',
        policy: 'ultrathink',
        activation: 'server-owned',
        callerMaySelectPolicy: false,
        untrustedWorkflowTokensInert: true,
        attackBudget: 1000,
        executedAttackCount: null,
        authority: {
          authorityCeiling: 'reason',
          founderApprovalGranted: false,
          executionAuthorized: false,
          nextAuthority: 'founder-control-room',
        },
      },
      governanceBoundary: {
        proposalOnly: true,
        executionAuthorized: false,
        founderApprovalRequired: true,
        remoteFounderSurfacesMaySelfAuthorize: false,
        callerWorkflowTokensAuthoritative: false,
        connectionResolutionAuthority: 'founder-control-room',
      },
      founderControl: {
        chiefMaySelfAuthorize: false,
        surfaceMaySelfAuthorize: false,
        executionAuthorized: false,
      },
      authority: {
        proposalOnly: true,
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
    expect(payload.result.structuredContent.reasoningPolicy.subjectPlanHash)
      .toBe(payload.result.structuredContent.capabilityPlan.planHash);
    expect(payload.result.structuredContent.reasoningPolicy.policyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.result.structuredContent.capabilityPlan.requestedAuthority).toBe('reason');
    expect(payload.result.structuredContent.handoffReceipt.continuityFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.result.structuredContent.handoffReceipt.continuityCookie.browserCookie).toBe(false);
    expect(payload.result.structuredContent.handoffReceipt.continuityCookie.actionAuthority).toBe(false);
    expect(payload.result.structuredContent.capabilityPlan.expectedHeadSha).toBe(expectedHeadSha);
    expect(payload.result.structuredContent.capabilityPlan.registryHash).toBe(snapshot.registryHash);
    expect(payload.result.structuredContent.capabilityPlan.strategicLenses).not.toContain('/ultrathink');
    expect(payload.result.structuredContent.capabilityPlan.strategicLenses).not.toContain('goalfix');
    expect(payload.result.structuredContent.capabilityPlan.strategicLenses).not.toContain('caller-injected-mode');
  });

  it('rejects requests missing required authentication context (missing Content-Type)', async () => {
    const response = await handleChiefMcp(new Request('https://chief.example/mcp', {
      method: 'POST',
      body: JSON.stringify({ jsonrpc: '2.0', id: 10, method: 'initialize', params: {} }),
    }));

    expect(response.status).toBe(415);
    const payload = await json(response);
    expect(payload.error.code).toBe(-32600);
  });

  it('rejects requests with invalid authentication (forged cross-origin)', async () => {
    const response = await handleChiefMcp(new Request('https://chief.example/mcp', {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
        Origin: 'https://attacker.example',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 11, method: 'tools/list', params: {} }),
    }));

    expect(response.status).toBe(403);
    const payload = await json(response);
    expect(payload.error.code).toBe(-32000);
    expect(payload.error.message).toContain('Origin');
  });

  it('rejects project scope mismatch via unexpected fields in capability-plan proposal', async () => {
    const response = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'compose_capability_plan',
        arguments: {
          proposal: {
            goalPlan: goal(),
            registrySnapshot: registry(),
            expectedHeadSha,
            projectOverride: 'attacker/other-repo',
          },
        },
      },
    }));

    expect(response.status).toBe(200);
    const payload = await json(response);
    expect(payload.error.code).toBe(-32602);
    expect(payload.error.message).toContain('unexpected fields: projectOverride');
  });

  it('fails closed on authority-shaped or unknown proposal fields', async () => {
    const response = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'compose_capability_plan',
        arguments: {
          proposal: {
            goalPlan: goal(),
            registrySnapshot: registry(),
            expectedHeadSha,
            founderApprovalId: 'caller-must-not-mint-authority',
          },
        },
      },
    }));

    expect(response.status).toBe(200);
    const payload = await json(response);
    expect(payload.error.code).toBe(-32602);
    expect(payload.error.message).toContain('unexpected fields: founderApprovalId');
  });

  it('reads bounded npm registry metadata and returns attributed documentation links', async () => {
    let requested;
    const fetchImpl = async (url, options) => {
      requested = { url, options };
      return Response.json({
        name: 'vitest',
        version: '3.0.0',
        description: 'JavaScript test runner documentation',
        homepage: 'https://vitest.dev/guide/',
      });
    };
    const response = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0', id: 15, method: 'tools/call',
      params: { name: 'lookup_dependency_docs', arguments: { package: 'vitest', query: 'test runner' } },
    }), { fetchImpl });
    const payload = await json(response);
    expect(response.status).toBe(200);
    expect(payload.result.isError).toBe(false);
    expect(requested?.url).toBe('https://registry.npmjs.org/vitest/latest');
    expect(requested?.options.method).toBe('GET');
    expect(payload.result.structuredContent.matchFound).toBe(true);
    expect(payload.result.structuredContent.links[0].url).toBe('https://www.npmjs.com/package/vitest');
    expect(payload.result.structuredContent.authority.executionAuthorized).toBe(false);
  });

  it('supports bounded PyPI names and never sends caller-provided URLs to fetch', async () => {
    const seen = [];
    const fetchImpl = async (url) => {
      seen.push(url);
      return Response.json({
        info: { version: '2.0', summary: 'Python project helper', description: 'Python package metadata',
          project_urls: { Documentation: 'https://docs.python.org/3/' } },
      });
    };
    const response = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0', id: 16, method: 'tools/call',
      params: { name: 'lookup_dependency_docs', arguments: { package: 'pypi:requests' } },
    }), { fetchImpl });
    const payload = await json(response);
    expect(seen).toEqual(['https://pypi.org/pypi/requests/json']);
    expect(payload.result.structuredContent.links[1].url).toBe('https://docs.python.org/3/');
    const rejected = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0', id: 17, method: 'tools/call',
      params: { name: 'lookup_dependency_docs', arguments: { package: 'https://attacker.example/' } },
    }), { fetchImpl });
    expect((await json(rejected)).error.code).toBe(-32602);
    expect(seen).toHaveLength(1);
  });

  it('returns an MCP tool error rather than fictional docs on registry failure', async () => {
    const response = await handleChiefMcp(legacyRequest({
      jsonrpc: '2.0', id: 18, method: 'tools/call',
      params: { name: 'lookup_dependency_docs', arguments: { package: 'vitest' } },
    }), { fetchImpl: async () => new Response('no', { status: 503 }) });
    const payload = await json(response);
    expect(response.status).toBe(200);
    expect(payload.result.isError).toBe(true);
    expect(payload.result.structuredContent.errorCode).toBe('dependency_docs_failed');
  });

  it('keeps 2026 MCP request header enforcement and advertised tools consistent', async () => {
    const request = new Request('https://chief.example/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/list',
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 19, method: 'tools/list',
        params: { _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientCapabilities': {},
        } },
      }),
    });
    const response = await handleChiefMcp(request);
    const payload = await json(response);
    expect(response.status).toBe(200);
    expect(payload.result.resultType).toBe('complete');
    expect(payload.result.tools.map((item) => item.name)).toEqual([
      'audit_repository', 'lookup_dependency_docs', 'compose_capability_plan',
    ]);
  });

});