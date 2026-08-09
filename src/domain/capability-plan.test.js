import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_PLAN_CONTRACT,
  capabilityPlanHash,
  createCapabilityPlan,
  validateCapabilityPlan,
} from './capability-plan.js';

const SHA = 'a'.repeat(40);
const HASH = 'b'.repeat(64);

function basePlan(overrides = {}) {
  return createCapabilityPlan({
    goal: 'Route one verified V10 capability slice.',
    projectSlug: 'founder-control-room',
    expectedHeadSha: SHA,
    requestedAuthority: 'draft',
    capabilities: [
      {
        id: 'goalfix',
        version: '1.0.0',
        origin: 'founder-native',
        owner: 'juss',
        sourceHash: HASH,
        authorityCeiling: 'privileged',
      },
    ],
    proofRequirements: ['focused tests', 'exact-head evidence'],
    rollback: 'Discard the plan; no execution authority is transferred.',
    ...overrides,
  });
}

describe('V10 capability plans', () => {
  it('creates a deterministic Chief-AI-owned plan with provenance', () => {
    const plan = basePlan();

    expect(plan.contract).toBe(CAPABILITY_PLAN_CONTRACT);
    expect(plan.selectedBy).toBe('chief-ai-machine');
    expect(plan.planHash).toMatch(/^[0-9a-f]{64}$/);
    expect(capabilityPlanHash(plan)).toBe(plan.planHash);
    expect(validateCapabilityPlan(plan)).toEqual({ valid: true, errors: [] });
  });

  it('changes the plan hash when the selected capability changes', () => {
    const first = basePlan();
    const second = basePlan({
      capabilities: [
        {
          id: 'repo-truth',
          version: '1.0.0',
          origin: 'repo-native',
          owner: 'chief-ai-machine',
          sourceHash: 'c'.repeat(64),
          authorityCeiling: 'privileged',
        },
      ],
    });

    expect(second.planHash).not.toBe(first.planHash);
  });

  it('rejects non-owned selection and content-hash tampering', () => {
    const plan = basePlan();
    const spoofed = { ...plan, selectedBy: 'n8n' };
    const tampered = { ...plan, goal: 'Different goal.' };

    expect(validateCapabilityPlan(spoofed).errors).toContain('Capability selection must be owned by Chief AI Machine');
    expect(validateCapabilityPlan(tampered).errors).toContain('Capability plan hash does not match plan content');
  });

  it('prevents imported capabilities from self-escalating to privileged authority', () => {
    expect(() => basePlan({
      requestedAuthority: 'privileged',
      capabilities: [
        {
          id: 'community-shiny-tool',
          version: '1.0.0',
          origin: 'community',
          owner: 'external',
          sourceHash: 'd'.repeat(64),
          authorityCeiling: 'privileged',
        },
      ],
    })).toThrow('authority exceeds its community origin ceiling');
  });
});
