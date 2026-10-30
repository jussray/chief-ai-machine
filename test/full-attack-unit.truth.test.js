import { describe, expect, it } from 'vitest';
import { ATTACK_UNIT_MEMBERS, runFullAttackUnit } from '../security/full-attack-unit.mjs';

const sample = (overrides = {}) => ({
  verdict: 'HALLWAY',
  technicalIdentity: {
    actorFingerprint: 'test-fingerprint',
    claimedCrawler: 'googlebot',
    verifiedBot: false,
  },
  receipt: 'a'.repeat(64),
  hallway: {
    active: true,
    logicalExpansion: 48_123,
    lazyMaterialization: true,
    productionExposure: 0,
    realCustomerData: false,
    realCredentials: false,
    crossSessionSharing: false,
  },
  boundaries: {
    ownedOrAuthorizedSurfacesOnly: true,
    externalCompromise: false,
    externalExploit: false,
    outboundRetaliation: false,
  },
  ...overrides,
});

describe('Chief full-unit framework truth', () => {
  it('executes inline policy checks without claiming full framework or external council invocation', () => {
    const unit = runFullAttackUnit(sample());
    expect(unit.unitVerdict).toBe('CONTAIN_ONLY');
    expect(unit.mode).toBe('local_policy_checks_only');
    expect(unit.expectedCount).toBe(ATTACK_UNIT_MEMBERS.length);
    expect(unit.evaluatedCount).toBe(ATTACK_UNIT_MEMBERS.length);
    expect(unit.executedCount).toBe(0);
    expect(unit.frameworkInvocationsVerified).toBe(0);
    expect(unit.allMembersAccountedFor).toBe(true);
    expect(unit.results.every((r) => r.evaluated === true && r.executed === false &&
      r.frameworkInvoked === false && r.executionScope === 'inline-rule-only')).toBe(true);
    expect(unit.results.find((r) => r.flow === 'ooda')?.status).toBe('LOCAL_EVALUATION');
    expect(unit.results.find((r) => r.flow === 'ultrathink')?.status).toBe('LOCAL_EVALUATION');
  });

  it('rejects invalid and synthetic expansion input rather than coercing it to safe bounds', () => {
    for (const expansion of [-1, 48_000.5, '48_123', 96_000]) {
      const unit = runFullAttackUnit(sample({
        hallway: { ...sample().hallway, logicalExpansion: expansion },
      }));
      expect(unit.unitVerdict).toBe('REPAIR_REQUIRED');
      expect(unit.results.find((r) => r.flow === 'attack-5000')?.status).toBe('BLOCK');
    }
  });

  it('accepts only SHA-256-shaped receipt values without calling them authenticated proof', () => {
    for (const receipt of ['z'.repeat(64), 'a'.repeat(32), '']) {
      const unit = runFullAttackUnit(sample({ receipt }));
      expect(unit.unitVerdict).toBe('REPAIR_REQUIRED');
      expect(unit.results.find((r) => r.flow === 'attack-6000')?.status).toBe('BLOCK');
      expect(unit.results.find((r) => r.flow === 'proof-mode')?.status).toBe('BLOCK');
    }
  });

  it('fails closed when synthetic hallway data isolation is violated', () => {
    const unit = runFullAttackUnit(sample({
      hallway: { ...sample().hallway, realCustomerData: true },
    }));
    expect(unit.unitVerdict).toBe('REPAIR_REQUIRED');
    expect(unit.results.find((r) => r.flow === 'attack-48000')?.status).toBe('BLOCK');
    expect(unit.results.find((r) => r.flow === 'l99')?.status).toBe('BLOCK');
  });
});
