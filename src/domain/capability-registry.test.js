import { describe, expect, it } from 'vitest';
import { sha256Hex, createCapabilityPlan } from './capability-plan.js';
import {
  createCapabilityRegistry,
  executionContinuityFingerprint,
  executionSlotKey,
  createExecutionHandoffReceipt,
  resolveCapabilities,
  validateCapabilityRegistry,
} from './capability-registry.js';

function registry() {
  return createCapabilityRegistry({
    registryId: 'chief-ai-test-registry',
    version: '2026-08-13.1',
    approvedBy: 'founder',
    capabilities: [{
      id: 'goalfix-v1',
      version: '1.0.0',
      origin: 'repo-native',
      owner: 'jussray/chief-ai-machine',
      sourceHash: sha256Hex('fixture:goalfix-v1:1.0.0'),
      authorityCeiling: 'reversible',
    }],
  });
}

describe('trusted capability registry', () => {
  it('preserves non-authorizing continuity evidence bound to plan and exact head', () => {
    const plan = createCapabilityPlan({
      goal: 'Review the Chief/FCR trust boundary',
      projectSlug: 'chief-ai-machine',
      expectedHeadSha: 'a'.repeat(40),
      registryHash: 'b'.repeat(64),
      requestedAuthority: 'reason',
      strategicLenses: ['truthmode'],
      routingReason: 'Keep execution outside the reasoning plane.',
      capabilities: [{
        id: 'goalfix-v1', version: '1.0.0', origin: 'repo-native',
        owner: 'jussray/chief-ai-machine', sourceHash: sha256Hex('fixture'),
        authorityCeiling: 'reversible',
      }],
      proofRequirements: ['exact-head review'],
      outcomeSignals: ['reviewed'],
      rollback: 'Discard the proposal',
    });
    const receipt = createExecutionHandoffReceipt(plan);
    expect(receipt.actionAuthority).toBe(false);
    expect(receipt.requiresFounderApproval).toBe(true);
    expect(receipt.continuityFingerprint).toBe(executionContinuityFingerprint(plan));
    expect(receipt.executionSlotKey).toBe(executionSlotKey(plan));
    expect(receipt.continuityCookie).toMatchObject({
      browserCookie: false,
      actionAuthority: false,
      boundedToExactHead: plan.expectedHeadSha,
      invalidatesOnPlanChange: true,
      invalidatesOnHeadChange: true,
    });
    expect(receipt.continuityCookie.value).toContain('chief-continuity-v1.');
  });

  it('accepts a registry whose content matches its hash', () => {
    expect(validateCapabilityRegistry(registry())).toEqual({ valid: true, errors: [] });
  });

  it('rejects content changed after the registry hash was created', () => {
    const snapshot = registry();
    const changed = {
      ...snapshot,
      capabilities: snapshot.capabilities.map((item) => ({ ...item, version: '2.0.0' })),
    };
    expect(validateCapabilityRegistry(changed).valid).toBe(false);
  });

  it('rejects a requested capability missing from the registry', () => {
    expect(() => resolveCapabilities(registry(), ['missing-capability']))
      .toThrow('Untrusted or unknown capabilities: missing-capability');
  });
});
