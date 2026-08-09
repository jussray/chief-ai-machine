import { describe, expect, it } from 'vitest';
import { createCapabilityPlan, validateCapabilityPlan } from './capability-plan.js';

const BASE = {
  goal: 'Ship one bounded V10 capability.',
  projectSlug: 'chief-ai-machine',
  expectedHeadSha: 'a'.repeat(40),
  registryHash: 'b'.repeat(64),
  requestedAuthority: 'draft',
  strategicLenses: ['futureyou', 'truthmode', 'redteam'],
  routingReason: 'Select the smallest capability set that can prove the next gate.',
  capabilities: [{
    id: 'goalfix',
    version: '1.0.0',
    origin: 'founder-native',
    owner: 'juss',
    sourceHash: 'c'.repeat(64),
    authorityCeiling: 'privileged',
  }],
  proofRequirements: ['exact-head tests'],
  outcomeSignals: ['verification-pass'],
  rollback: 'Revert the focused branch.',
};

describe('V10 capability security', () => {
  it('detects mutation after plan hashing', () => {
    const plan = createCapabilityPlan(BASE);
    expect(validateCapabilityPlan({ ...plan, routingReason: 'tampered' }).errors)
      .toContain('Capability plan hash does not match plan content');
  });

  it('does not let provider/community/vendor capability request privileged authority', () => {
    for (const origin of ['provider', 'community', 'vendor']) {
      expect(() => createCapabilityPlan({
        ...BASE,
        requestedAuthority: 'privileged',
        capabilities: [{
          id: `${origin}-skill`,
          version: '1.0.0',
          origin,
          owner: 'external',
          sourceHash: 'd'.repeat(64),
          authorityCeiling: 'privileged',
        }],
      })).toThrow(`authority exceeds its ${origin} origin ceiling`);
    }
  });

  it('refuses duplicate capability identities', () => {
    expect(() => createCapabilityPlan({
      ...BASE,
      capabilities: [BASE.capabilities[0], BASE.capabilities[0]],
    })).toThrow('Duplicate capability id');
  });
});
