import { describe, expect, it } from 'vitest';
import { createGoalPlan } from './goal-plan.js';
import { sha256Hex } from './capability-plan.js';
import { createCapabilityRegistry, createGoalCapabilityPlan } from './capability-registry.js';

const snapshot = createCapabilityRegistry({
  registryId: 'test-registry',
  version: '1',
  approvedBy: 'founder',
  capabilities: [{
    id: 'goalfix-v1',
    version: '1',
    origin: 'repo-native',
    owner: 'chief-ai-machine',
    sourceHash: sha256Hex('goalfix-v1'),
    authorityCeiling: 'reversible',
  }],
});

describe('goal capability bridge', () => {
  it('binds a ready goal to the approved snapshot', () => {
    const goal = createGoalPlan({
      goal: 'Verify the next product change',
      project: 'chief-ai-machine',
      definitionOfDone: 'The plan is valid',
      strategicLenses: ['ooda'],
      capabilities: ['goalfix-v1'],
      proofRequirements: ['tests green'],
      rollback: 'revert commit',
      nextGate: 'founder review',
    });
    const plan = createGoalCapabilityPlan({
      goalPlan: goal,
      registrySnapshot: snapshot,
      expectedHeadSha: 'c5ab1674e2a46eed1d0ee4cadf59053026679b3a',
      requestedAuthority: 'reversible',
    });
    expect(plan.registryHash).toBe(snapshot.registryHash);
    expect(plan.capabilities[0].id).toBe('goalfix-v1');
  });
});
