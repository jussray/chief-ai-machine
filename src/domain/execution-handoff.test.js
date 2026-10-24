import { describe, expect, it } from 'vitest';
import {
  capabilityPlanHash,
  createCapabilityPlan,
  sha256Hex,
} from './capability-plan.js';
import {
  CONTINUITY_COOKIE_CONTRACT,
  createExecutionHandoffReceipt,
  EXECUTION_HANDOFF_CONTRACT,
  executionContinuityFingerprint,
  executionSlotKey,
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
      'continuityCookie',
      'continuityFingerprint',
      'contract',
      'executionSlotKey',
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

  it('keeps projected capability, proof, outcome, and continuity state immutable in process', () => {
    const receipt = createExecutionHandoffReceipt(plan());

    expect(Object.isFrozen(receipt)).toBe(true);
    expect(Object.isFrozen(receipt.capabilityIds)).toBe(true);
    expect(Object.isFrozen(receipt.proofRequirements)).toBe(true);
    expect(Object.isFrozen(receipt.outcomeSignals)).toBe(true);
    expect(Object.isFrozen(receipt.continuityCookie)).toBe(true);

    expect(() => Reflect.apply(Array.prototype.push, receipt.proofRequirements, ['forged gate']))
      .toThrow(TypeError);
    expect(() => Reflect.apply(Array.prototype.push, receipt.outcomeSignals, ['forged outcome']))
      .toThrow(TypeError);
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

  it('emits a deterministic bounded continuity fingerprint and non-browser cookie', () => {
    const capabilityPlan = plan();
    const first = createExecutionHandoffReceipt(capabilityPlan);
    const second = createExecutionHandoffReceipt(capabilityPlan);

    expect(first.continuityFingerprint).toBe(executionContinuityFingerprint(capabilityPlan));
    expect(second.continuityFingerprint).toBe(first.continuityFingerprint);
    expect(first.continuityCookie).toEqual(second.continuityCookie);
    expect(first.continuityCookie.contract).toBe(CONTINUITY_COOKIE_CONTRACT);
    expect(first.continuityCookie.value).toBe(`chief-continuity-v1.${first.continuityFingerprint}`);
    expect(first.continuityCookie.browserCookie).toBe(false);
    expect(first.continuityCookie.actionAuthority).toBe(false);
    expect(first.continuityCookie.boundedToExactHead).toBe(capabilityPlan.expectedHeadSha);
    expect(first.continuityCookie.invalidatesOnPlanChange).toBe(true);
    expect(first.continuityCookie.invalidatesOnHeadChange).toBe(true);
  });

  it('invalidates continuity when exact head, proof, or rollback changes', () => {
    const original = plan();
    const variants = [
      { ...original, expectedHeadSha: 'd'.repeat(40) },
      { ...original, proofRequirements: [...original.proofRequirements, 'playwright exact-head green'] },
      { ...original, rollback: 'revert the focused continuity commit' },
    ].map((variant) => {
      const withHash = { ...variant, planHash: '' };
      withHash.planHash = capabilityPlanHash(withHash);
      return withHash;
    });

    const baseline = createExecutionHandoffReceipt(original);
    for (const variant of variants) {
      const changed = createExecutionHandoffReceipt(variant);
      expect(changed.continuityFingerprint).not.toBe(baseline.continuityFingerprint);
      expect(changed.continuityCookie.value).not.toBe(baseline.continuityCookie.value);
    }
  });

  it('derives one project-plus-head execution slot for downstream in-flight exclusion', () => {
    const original = plan();
    const sameProjectHeadDifferentGoal = {
      ...original,
      goal: 'Verify another focused change',
      planHash: '',
    };
    sameProjectHeadDifferentGoal.planHash = capabilityPlanHash(sameProjectHeadDifferentGoal);

    const nextHead = {
      ...original,
      expectedHeadSha: 'e'.repeat(40),
      planHash: '',
    };
    nextHead.planHash = capabilityPlanHash(nextHead);

    expect(executionSlotKey(sameProjectHeadDifferentGoal)).toBe(executionSlotKey(original));
    expect(executionSlotKey(nextHead)).not.toBe(executionSlotKey(original));
    expect(createExecutionHandoffReceipt(original).executionSlotKey).toBe(executionSlotKey(original));
  });
});
