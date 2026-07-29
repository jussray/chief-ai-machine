import { describe, expect, it } from 'vitest';
import { FRIEND_MODE_RULE_VERSION, resolveFriendInput } from './friend-mode.js';

describe('resolveFriendInput', () => {
  it('returns an explicit empty state without fabricating a decision', () => {
    const result = resolveFriendInput('');

    expect(result.status).toBe('empty');
    expect(result.dominantDomain).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.provenance.ruleVersion).toBe(FRIEND_MODE_RULE_VERSION);
  });

  it('prioritizes life-critical language over build pressure', () => {
    const result = resolveFriendInput('Daycare sent another balance and I still need to ship the launch.', 'medium');

    expect(result.dominantDomain).toBe('life');
    expect(result.competingDomains).toContain('builds');
    expect(result.truth.unknown[0]).toMatch(/not checked/i);
    expect(result.provenance.providerCalls).toBe(0);
    expect(result.provenance.toolCalls).toBe(0);
  });

  it('raises build priority when energy is high and no higher-order domain is present', () => {
    const result = resolveFriendInput('I need to fix the repo bug and deploy the product.', 'high');

    expect(result.dominantDomain).toBe('builds');
    expect(result.action).toMatch(/smallest valuable build move/i);
  });

  it('falls back to noise compression for unmatched input', () => {
    const result = resolveFriendInput('Everything feels scattered today.', 'low');

    expect(result.dominantDomain).toBe('noise');
    expect(result.action).toMatch(/compress the noise/i);
  });
});
