import { describe, expect, it } from 'vitest';
import {
  capabilityPlanHash,
  createCapabilityPlan,
  sha256Hex,
} from './capability-plan.js';
import {
  createExecutionHandoffReceipt,
  EXECUTION_HANDOFF_CONTRACT,
} from './capability-registry.js';

function plan() {
  return createCapabilityPlan({
    goal: 'Verify a focused change',
    projectSlug: 'chief-ai-machine',
    expectedHeadSha: 'c5ab1674e2a46eed1d0ee4cadf59053026679b3a',
    registryHash: sha256Hex('registry'),
    requestedAuthority: 'reason',
    strategicLenses: ['ooda'],
    routingReason: 'test fixture',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1',
      origin: 'repo-native',
      owner: 'chief-ai-machine',
      sourceHash: sha256Hex('goalfix-v1'),
      authorityCeiling: 'reversible',
    }],
    proofRequirements: ['tests green'],
    outcomeSignals: ['plan remains bounded'],
    rollback: 'revert commit',
  });
}

describe('execution handoff receipt', () => {
  it('emits one exact proposal-only schema and requires founder approval', () => {
    const capabilityPlan = plan();
    const receipt = createExecutionHandoffReceipt(capabilityPlan);

    expect(receipt.contract).toBe(EXECUTION_HANDOFF_CONTRACT);
    expect(receipt.status).toBe('proposed');
    expect(receipt.actionAuthority).toBe(false);
    expect(receipt.requiresFounderApproval).toBe(true);
    expect(receipt.capabilityPlanHash).toBe(capabilityPlan.planHash);
    expect(receipt.expectedHeadSha).toBe(capabilityPlan.expectedHeadSha);
    expect(receipt.outcomeSignals).toEqual(capabilityPlan.outcomeSignals);

    expect(Object.keys(receipt).sort()).toEqual([
      'actionAuthority',
      'capabilityIds',
      'capabilityPlanHash',
      'contract',
      'expectedHeadSha',
      'goal',
      'outcomeSignals',
      'projectSlug',
      'proofRequirements',
      'registryHash',
      'requestedAuthority',
      'requiresFounderApproval',
      'rollback',
      'selectedBy',
      'status',
    ].sort());

    for (const forbidden of [
      'executionAuthorized',
      'actor',
      'founderId',
      'decisionReceiptId',
      'policyDecisionId',
      'cookieAuthority',
    ]) {
      expect(receipt).not.toHaveProperty(forbidden);
    }
  });

  it('preserves every validated proof gate instead of truncating the projection', () => {
    const capabilityPlan = plan();
    const proofRequirements = Array.from({ length: 31 }, (_, index) => `proof-${String(index + 1).padStart(2, '0')}`);
    const deserializedPlan = {
      ...capabilityPlan,
      proofRequirements,
      planHash: '',
    };
    deserializedPlan.planHash = capabilityPlanHash(deserializedPlan);

    const receipt = createExecutionHandoffReceipt(deserializedPlan);

    expect(receipt.proofRequirements).toEqual(proofRequirements);
    expect(receipt.proofRequirements).toHaveLength(31);
    expect(receipt.capabilityPlanHash).toBe(deserializedPlan.planHash);
  });

  it('keeps projected capability, proof, and outcome arrays immutable in process', () => {
    const receipt = createExecutionHandoffReceipt(plan());

    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.capabilityIds)).toBe(true);
    expect(Object.isFrozen(receipt.proofRequirements)).toBe(true);
    expect(Object.isFrozen(receipt.outcomeSignals)).toBe(true);

    expect(() => receipt.proofRequirements.push('forged gate')).toThrow(TypeError);
    expect(() => receipt.outcomeSignals.push('forged outcome')).toThrow(TypeError);
  });

  it('binds state-sensitive proposal fields through the capability-plan hash', () => {
    const original = plan();
    const changed = {
      ...original,
      expectedHeadSha: 'd'.repeat(40),
      outcomeSignals: [...original.outcomeSignals, 'runtime matches changed head'],
      planHash: '',
    };
    changed.planHash = capabilityPlanHash(changed);

    const originalReceipt = createExecutionHandoffReceipt(original);
    const changedReceipt = createExecutionHandoffReceipt(changed);

    expect(changedReceipt.capabilityPlanHash).not.toBe(originalReceipt.capabilityPlanHash);
    expect(changedReceipt.expectedHeadSha).not.toBe(originalReceipt.expectedHeadSha);
    expect(changedReceipt.outcomeSignals).toContain('runtime matches changed head');
  });
});
