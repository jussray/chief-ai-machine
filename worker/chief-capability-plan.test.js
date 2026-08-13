import { describe, expect, it } from 'vitest';
import { createCapabilityRegistry } from '../src/domain/capability-registry.js';
import { sha256Hex } from '../src/domain/capability-plan.js';
import { createGoalPlan } from '../src/domain/goal-plan.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';

const expectedHeadSha = '73c36e61dae96bf1bb94990d3b5e5a6a0bb70b24';

function registry(authorityCeiling = 'reversible') {
  return createCapabilityRegistry({
    registryId: 'chief-api-test-registry',
    version: '2026-08-13.1',
    approvedBy: 'founder-fixture',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1.0.0',
      origin: 'repo-native',
      owner: 'jussray/chief-ai-machine',
      sourceHash: sha256Hex('goalfix-v1-fixture'),
      authorityCeiling,
    }],
  });
}

function goal(capabilities = ['goalfix-v1']) {
  return createGoalPlan({
    goal: 'Prepare one bounded change for founder review',
    project: 'chief-ai-machine',
    definitionOfDone: 'The proposal is deterministic and execution remains disabled',
    strategicLenses: ['ooda', 'redteam'],
    capabilities,
    proofRequirements: ['exact-head tests are green'],
    rollback: 'discard the proposal',
    nextGate: 'Founder Control Room review',
  });
}

function request(body, method = 'POST') {
  return new Request('https://chief.example/api/chief/capability-plan', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

async function payload(response) {
  return response.json();
}

describe('Chief capability-plan proposal API', () => {
  it('returns a deterministic plan and a non-authorizing handoff proposal', async () => {
    const snapshot = registry();
    const response = await handleChiefCapabilityPlan(request({
      goalPlan: goal(),
      registrySnapshot: snapshot,
      expectedHeadSha,
      requestedAuthority: 'reversible',
    }));

    expect(response.status).toBe(200);
    const body = await payload(response);
    expect(body.error).toBeNull();
    expect(body.data.capabilityPlan.contract).toBe('juss-v10/capability-plan@v1');
    expect(body.data.capabilityPlan.expectedHeadSha).toBe(expectedHeadSha);
    expect(body.data.capabilityPlan.registryHash).toBe(snapshot.registryHash);
    expect(body.data.handoffReceipt.contract).toBe('juss-v10/execution-handoff@v1');
    expect(body.data.handoffReceipt.status).toBe('proposed');
    expect(body.data.handoffReceipt.actionAuthority).toBe(false);
    expect(body.data.handoffReceipt.requiresFounderApproval).toBe(true);
    expect(body.data.governanceBoundary).toMatchObject({
      proposalOnly: true,
      executionAuthorized: false,
      registrySnapshotResolvedByFcr: false,
      exactHeadVerifiedByFcr: false,
      founderApprovalRequired: true,
    });
  });

  it('rejects a capability absent from the submitted registry snapshot', async () => {
    const response = await handleChiefCapabilityPlan(request({
      goalPlan: goal(['unknown-capability']),
      registrySnapshot: registry(),
      expectedHeadSha,
    }));

    expect(response.status).toBe(400);
    const body = await payload(response);
    expect(body.error.code).toBe('invalid_capability_plan_request');
    expect(body.error.message).toContain('Untrusted or unknown capabilities');
  });

  it('rejects a founder goal that has not reached its own proof gate', async () => {
    const response = await handleChiefCapabilityPlan(request({
      goalPlan: {
        goal: 'Incomplete goal',
        project: 'chief-ai-machine',
        priority: 'now',
        definitionOfDone: 'Something changes',
        capabilities: ['goalfix-v1'],
        strategicLenses: ['ooda'],
        proofRequirements: [],
        rollback: '',
        nextGate: '',
      },
      registrySnapshot: registry(),
      expectedHeadSha,
    }));

    expect(response.status).toBe(400);
    const body = await payload(response);
    expect(body.error.message).toContain('Founder goal is not ready');
  });

  it('rejects authority broader than the capability ceiling', async () => {
    const response = await handleChiefCapabilityPlan(request({
      goalPlan: goal(),
      registrySnapshot: registry('draft'),
      expectedHeadSha,
      requestedAuthority: 'reversible',
    }));

    expect(response.status).toBe(400);
    const body = await payload(response);
    expect(body.error.message).toContain('cannot satisfy requested authority reversible');
  });

  it('fails closed on malformed JSON and unsupported methods', async () => {
    const malformed = await handleChiefCapabilityPlan(new Request(
      'https://chief.example/api/chief/capability-plan',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' },
    ));
    expect(malformed.status).toBe(400);
    expect((await payload(malformed)).error.code).toBe('invalid_json');

    const get = await handleChiefCapabilityPlan(request({}, 'GET'));
    expect(get.status).toBe(405);
    expect((await payload(get)).error.code).toBe('method_not_allowed');
  });
});
