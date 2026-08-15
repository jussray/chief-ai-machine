import { describe, expect, it } from 'vitest';
import { createCapabilityRegistry } from '../src/domain/capability-registry.js';
import { sha256Hex } from '../src/domain/capability-plan.js';
import { createGoalPlan } from '../src/domain/goal-plan.js';
import { handleChiefCapabilityPlan } from './chief-capability-plan.js';

const expectedHeadSha = '73c36e61dae96bf1bb94990d3b5e5a6a0bb70b24';

function registry() {
  return createCapabilityRegistry({
    registryId: 'chief-feedback-test-registry',
    version: '2026-08-15.1',
    approvedBy: 'founder-fixture',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1.0.0',
      origin: 'repo-native',
      owner: 'jussray/chief-ai-machine',
      sourceHash: sha256Hex('goalfix-v1-feedback-fixture'),
      authorityCeiling: 'reversible',
    }],
  });
}

function goal() {
  return createGoalPlan({
    goal: 'Choose the next bounded route from verified outcome feedback',
    project: 'chief-ai-machine',
    definitionOfDone: 'The next route reacts to prior outcome evidence without raising authority',
    strategicLenses: ['ooda', 'truthmode'],
    capabilities: ['goalfix-v1'],
    proofRequirements: ['exact-head tests are green'],
    rollback: 'discard the proposal',
    nextGate: 'Founder Control Room review',
  });
}

function outcome(overrides = {}) {
  return {
    contract: 'juss-v10/outcome-observation@v1',
    capabilityPlanHash: 'a'.repeat(64),
    executionReceiptId: `fcr-conveyor-receipt-v3:${'b'.repeat(64)}`,
    verified: true,
    goalSucceeded: true,
    founderOverride: false,
    rollbackUsed: false,
    evidenceCompleteness: 100,
    outcomeSignals: ['verification-pass'],
    evidenceUrls: ['https://github.com/jussray/founder-control-room/actions/runs/1'],
    ...overrides,
  };
}

async function propose(latestOutcomeObservation) {
  const response = await handleChiefCapabilityPlan(new Request(
    'https://chief.example/api/chief/capability-plan',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goalPlan: goal(),
        registrySnapshot: registry(),
        expectedHeadSha,
        requestedAuthority: 'reversible',
        latestOutcomeObservation,
      }),
    },
  ));
  return { response, body: await response.json() };
}

describe('Chief runtime outcome feedback', () => {
  it('keeps reversible as a founder-gated request after strong verified success', async () => {
    const { response, body } = await propose(outcome());
    expect(response.status).toBe(200);
    expect(body.data.outcomeFeedback.recommendation).toBe('candidate-promote');
    expect(body.data.outcomeFeedback.effectiveAuthority).toBe('reversible');
    expect(body.data.outcomeFeedback.promotionAllowed).toBe(false);
    expect(body.data.capabilityPlan.requestedAuthority).toBe('reversible');
    expect(body.data.governanceBoundary.outcomeCanIncreaseAuthority).toBe(false);
  });

  it('downgrades the next plan to reasoning-only after a verified goal failure', async () => {
    const { response, body } = await propose(outcome({ goalSucceeded: false }));
    expect(response.status).toBe(200);
    expect(body.data.outcomeFeedback.recommendation).toBe('review');
    expect(body.data.outcomeFeedback.effectiveAuthority).toBe('reason');
    expect(body.data.capabilityPlan.requestedAuthority).toBe('reason');
    expect(body.data.capabilityPlan.routingReason).toContain('Prior FCR outcome recommends review');
  });

  it('fails closed to reasoning-only for unverified feedback', async () => {
    const { response, body } = await propose(outcome({
      verified: false,
      goalSucceeded: null,
      evidenceUrls: [],
    }));
    expect(response.status).toBe(200);
    expect(body.data.outcomeFeedback.recommendation).toBe('hold');
    expect(body.data.outcomeFeedback.effectiveAuthority).toBe('reason');
    expect(body.data.capabilityPlan.requestedAuthority).toBe('reason');
  });
});
