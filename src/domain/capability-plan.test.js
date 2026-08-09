import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_PLAN_CONTRACT,
  capabilityPlanHash,
  createCapabilityPlan,
  sha256Hex,
  validateCapabilityPlan,
} from './capability-plan.js';

const SHA = 'a'.repeat(40);
const HASH = 'b'.repeat(64);
const REGISTRY_HASH = 'e'.repeat(64);
const CONFORMANCE_HASH = '7a2f344b9086b8a5a86ece6f027ad727bd76c2ac8a1e0efe2fb41133727c153d';

function basePlan(overrides = {}) {
  return createCapabilityPlan({
    goal: 'Route one verified V10 capability slice.',
    projectSlug: 'founder-control-room',
    expectedHeadSha: SHA,
    registryHash: REGISTRY_HASH,
    requestedAuthority: 'draft',
    strategicLenses: ['me', 'futureyou', 'billgates', 'elonmusk', 'truthmode'],
    routingReason: 'Use the smallest evidence-bound capability set that advances the founder goal.',
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
    outcomeSignals: ['verification-pass', 'founder-override-rate'],
    rollback: 'Revert the focused branch; no execution authority is transferred by the plan.',
    ...overrides,
  });
}

describe('V10 capability plans', () => {
  it('matches the standard SHA-256 test vector without Node-only crypto', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('matches the cross-runtime V10 capability-plan conformance hash', () => {
    const fixture = createCapabilityPlan({
      goal: 'Conformance fixture.',
      projectSlug: 'founder-control-room',
      expectedHeadSha: 'a'.repeat(40),
      registryHash: 'b'.repeat(64),
      requestedAuthority: 'draft',
      strategicLenses: ['futureyou', 'truthmode'],
      routingReason: 'Verify cross-runtime capability-plan hashing.',
      capabilities: [{
        id: 'goalfix',
        version: '1.0.0',
        origin: 'founder-native',
        owner: 'juss',
        sourceHash: 'c'.repeat(64),
        authorityCeiling: 'privileged',
      }],
      proofRequirements: ['exact-head evidence'],
      outcomeSignals: ['verification-pass'],
      rollback: 'Discard fixture.',
    });

    expect(fixture.planHash).toBe(CONFORMANCE_HASH);
  });

  it('creates a deterministic Chief-AI-owned plan with provenance, strategy, and measurement', () => {
    const plan = basePlan();

    expect(plan.contract).toBe(CAPABILITY_PLAN_CONTRACT);
    expect(plan.selectedBy).toBe('chief-ai-machine');
    expect(plan.registryHash).toBe(REGISTRY_HASH);
    expect(plan.strategicLenses).toContain('futureyou');
    expect(plan.outcomeSignals).toContain('verification-pass');
    expect(plan.planHash).toMatch(/^[0-9a-f]{64}$/);
    expect(capabilityPlanHash(plan)).toBe(plan.planHash);
    expect(validateCapabilityPlan(plan)).toEqual({ valid: true, errors: [] });
  });

  it('changes the plan hash when capability, registry, or outcome contract changes', () => {
    const first = basePlan();
    const capabilityChanged = basePlan({
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
    const registryChanged = basePlan({ registryHash: 'd'.repeat(64) });
    const outcomeChanged = basePlan({ outcomeSignals: ['different-success-signal'] });

    expect(capabilityChanged.planHash).not.toBe(first.planHash);
    expect(registryChanged.planHash).not.toBe(first.planHash);
    expect(outcomeChanged.planHash).not.toBe(first.planHash);
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

  it('requires a registry hash, routing reason, strategic lenses, proof, and outcome signals', () => {
    expect(() => basePlan({ registryHash: '' })).toThrow('registryHash must be sha256');
    expect(() => basePlan({ routingReason: '' })).toThrow('routing reason is required');
    expect(() => basePlan({ strategicLenses: [] })).toThrow('strategic lenses are required');
    expect(() => basePlan({ proofRequirements: [] })).toThrow('proof requirements are required');
    expect(() => basePlan({ outcomeSignals: [] })).toThrow('outcome signals are required');
  });
});
