import { expect, test } from '@playwright/test';
import { createCapabilityRegistry } from '../src/domain/capability-registry.js';
import { sha256Hex } from '../src/domain/capability-plan.js';
import { createGoalPlan } from '../src/domain/goal-plan.js';

const baseURL = process.env.CHIEF_CAPABILITY_PLAN_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;

if (!baseURL) throw new Error('CHIEF_CAPABILITY_PLAN_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');

function proposalInput() {
  const registrySnapshot = createCapabilityRegistry({
    registryId: 'chief-playwright-proposal-registry',
    version: '2026-08-13.1',
    approvedBy: 'playwright-fixture',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1.0.0',
      origin: 'repo-native',
      owner: 'jussray/chief-ai-machine',
      sourceHash: sha256Hex('playwright-goalfix-v1'),
      authorityCeiling: 'reversible',
    }],
  });

  return {
    goalPlan: createGoalPlan({
      goal: 'Prepare one exact-head proposal for Founder Control Room review',
      project: 'chief-ai-machine',
      definitionOfDone: 'The live Worker returns a bounded capability plan proposal',
      strategicLenses: ['ooda', 'redteam'],
      capabilities: ['goalfix-v1'],
      proofRequirements: ['live exact-head capability-plan API proof succeeds'],
      rollback: 'discard the proposal',
      nextGate: 'Founder Control Room verifies registry trust, exact head, and approval',
    }),
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

test.describe('Chief capability-plan live runtime', () => {
  test('serves the exact candidate head from /version', async ({ request }) => {
    const response = await request.get(`${baseURL}/version`);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sha: expectedHead });
  });

  test('returns a proposal-only plan plus a credential-free FCR connection handoff', async ({ request }) => {
    const input = proposalInput();
    const response = await request.post(`${baseURL}/api/chief/capability-plan`, {
      headers: { 'Content-Type': 'application/json' },
      data: input,
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.capabilityPlan.contract).toBe('juss-v10/capability-plan@v1');
    expect(body.data.capabilityPlan.expectedHeadSha).toBe(expectedHead);
    expect(body.data.capabilityPlan.registryHash).toBe(input.registrySnapshot.registryHash);
    expect(body.data.capabilityPlan.routingReason).toContain('submitted registry snapshot');
    expect(body.data.capabilityPlan.routingReason).toContain('Founder Control Room trust resolution is still required');
    expect(body.data.capabilityPlan.routingReason).not.toContain('trusted registry');
    expect(body.data.handoffReceipt.contract).toBe('juss-v10/execution-handoff@v1');
    expect(body.data.handoffReceipt.status).toBe('proposed');
    expect(body.data.handoffReceipt.actionAuthority).toBe(false);
    expect(body.data.handoffReceipt.requiresFounderApproval).toBe(true);
    expect(body.data.connectionHandoff).toMatchObject({
      contract: 'juss-v10/fcr-connection-requests@v1',
      selectedBy: 'chief-ai-machine',
      resolvedBy: 'founder-control-room',
      rawCredentialsAccepted: false,
      rawCredentialsReturned: false,
      resolver: '/mcp/vault/resolve',
      requiresScopedFcrApiToken: true,
      requests: [{
        connectionType: 'github',
        environment: 'production',
        capabilities: ['inspect_repos'],
      }],
    });
    expect(body.data.governanceBoundary).toMatchObject({
      proposalOnly: true,
      executionAuthorized: false,
      registrySnapshotResolvedByFcr: false,
      exactHeadVerifiedByFcr: false,
      founderApprovalRequired: true,
      connectionResolutionAuthority: 'founder-control-room',
      rawCredentialsAccepted: false,
      rawCredentialsReturned: false,
      connectionResolver: '/mcp/vault/resolve',
    });
    expect(JSON.stringify(body)).not.toMatch(/github_pat_|api[_-]?key|secretRef|privateKey/i);
  });

  test('fails closed when a connection request contains credential fields', async ({ request }) => {
    const input = proposalInput();
    input.connectionRequests[0].token = 'never-accept-this';

    const response = await request.post(`${baseURL}/api/chief/capability-plan`, {
      headers: { 'Content-Type': 'application/json' },
      data: input,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_capability_plan_request');
    expect(body.error.message).toContain('forbidden fields: token');
  });

  test('fails closed for a capability absent from the submitted snapshot', async ({ request }) => {
    const input = proposalInput();
    input.goalPlan.capabilities = ['unknown-capability'];

    const response = await request.post(`${baseURL}/api/chief/capability-plan`, {
      headers: { 'Content-Type': 'application/json' },
      data: input,
    });

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_capability_plan_request');
    expect(body.error.message).toContain('Untrusted or unknown capabilities');
  });
});
