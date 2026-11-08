import { describe, expect, it } from 'vitest';
import { createCapabilityPlan, sha256Hex } from './capability-plan.js';
import { createExecutionHandoffReceipt } from './capability-registry.js';

describe('execution handoff receipt', () => {
  it('stays proposed and requires founder approval', () => {
    const plan = createCapabilityPlan({
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
    const receipt = createExecutionHandoffReceipt(plan);
    expect(receipt.status).toBe('proposed');
    expect(receipt.actionAuthority).toBe(false);
    expect(receipt.requiresFounderApproval).toBe(true);
    expect(receipt.capabilityPlanHash).toBe(plan.planHash);
  });
});
