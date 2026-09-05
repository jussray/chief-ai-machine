import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ATTACK_1000_ATTACK_FAMILIES,
  ATTACK_1000_PRESSURE_BUDGET,
  createContinuityCookie,
  evaluateTrustTransition,
  fingerprintTrustTransition,
} from './trust-transition-v1.js';

const hash = (value) => createHash('sha256').update(value).digest('hex');

function mission(overrides = {}) {
  return {
    intent: { goal: 'Publish the approved test collection' },
    proposedAction: {
      action: 'publish_collection',
      target: 'fall-2026-test',
      parametersHash: hash('approved-products-v1'),
      idempotencyKey: 'mission-123:publish:fall-2026-test',
    },
    consequence: 'consequential',
    authority: {
      grantId: 'grant-123',
      action: 'publish_collection',
      target: 'fall-2026-test',
      scope: ['publish'],
      reusable: false,
    },
    recovery: {
      mode: 'correction',
      checkpoint: 'pre-publication',
      acknowledged: true,
    },
    runtimeFingerprint: hash('chief-runtime-a'),
    ...overrides,
  };
}

function proof(input, plane, options = {}) {
  const transitionFingerprint = fingerprintTrustTransition(input);
  const continuityCookie = createContinuityCookie(input);
  return {
    plane,
    state: 'VERIFIED',
    ref: `receipt://${plane}`,
    fingerprint: hash(`${plane}-proof`),
    transitionFingerprint,
    continuityCookie,
    independent: plane === 'outcome',
    ...options,
  };
}

describe('TrustTransitionV1', () => {
  it('binds the transition and continuity cookie deterministically', () => {
    const input = mission();
    const first = evaluateTrustTransition(input);
    const second = evaluateTrustTransition(input);

    expect(first.transitionFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first.continuityCookie).toMatch(/^[0-9a-f]{64}$/);
    expect(first.transitionFingerprint).toBe(second.transitionFingerprint);
    expect(first.continuityCookie).toBe(second.continuityCookie);
  });

  it('expires the cookie when runtime identity changes without rewriting the historical subject', () => {
    const original = mission();
    const expectedTransitionFingerprint = fingerprintTrustTransition(original);
    const expectedContinuityCookie = createContinuityCookie(original);
    const movedRuntime = mission({ runtimeFingerprint: hash('chief-runtime-b') });

    const result = evaluateTrustTransition({
      ...movedRuntime,
      expectedTransitionFingerprint,
      expectedContinuityCookie,
      historicalVerification: {
        outcomeVerified: true,
        evidenceFingerprint: hash('historical-outcome'),
      },
    });

    expect(result.subjectDrifted).toBe(false);
    expect(result.cookieExpired).toBe(true);
    expect(result.currentTruthState).toBe('stale');
    expect(result.historicalDisposition).toBe('verified');
    expect(result.disposition).toBe('unknown');
  });

  it('expires predecessor proof when the transition subject changes', () => {
    const original = mission();
    const changed = mission({
      proposedAction: {
        ...original.proposedAction,
        target: 'winter-2026-test',
        idempotencyKey: 'mission-123:publish:winter-2026-test',
      },
      authority: {
        ...original.authority,
        target: 'winter-2026-test',
      },
    });

    const result = evaluateTrustTransition({
      ...changed,
      expectedTransitionFingerprint: fingerprintTrustTransition(original),
    });

    expect(result.subjectDrifted).toBe(true);
    expect(result.currentTruthState).toBe('stale');
    expect(result.disposition).toBe('unknown');
  });

  it('rejects widened authority that does not match the proposed action target', () => {
    const input = mission({
      authority: {
        grantId: 'grant-123',
        action: 'publish_collection',
        target: '*',
        scope: ['publish', 'price-edit'],
        reusable: false,
      },
    });

    const result = evaluateTrustTransition(input);
    expect(result.valid).toBe(false);
    expect(result.disposition).toBe('blocked');
    expect(result.errors).toContain('authority target does not match proposed target');
  });

  it('requires idempotency for consequential execution', () => {
    const base = mission();
    const input = mission({
      proposedAction: { ...base.proposedAction, idempotencyKey: '' },
    });

    const result = evaluateTrustTransition(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('consequential actions require an idempotency key');
  });

  it('requires acknowledged recovery before consequence', () => {
    const input = mission({
      recovery: { mode: 'none', checkpoint: '', acknowledged: false },
    });

    const result = evaluateTrustTransition(input);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('consequential actions require acknowledged recovery');
  });

  it('does not upgrade provider acceptance into outcome truth', () => {
    const input = mission();
    const result = evaluateTrustTransition({
      ...input,
      evidence: [proof(input, 'execution')],
    });

    expect(result.executionVerified).toBe(true);
    expect(result.outcomeVerified).toBe(false);
    expect(result.disposition).toBe('unknown');
    expect(result.evidenceDecision.recommendation).toBe('MEASURE');
  });

  it('requires an independent outcome witness', () => {
    const input = mission();
    const result = evaluateTrustTransition({
      ...input,
      evidence: [
        proof(input, 'execution'),
        proof(input, 'outcome', { independent: false }),
      ],
    });

    expect(result.outcomeVerified).toBe(false);
    expect(result.rejectedEvidence).toContainEqual({
      plane: 'outcome',
      reason: 'OUTCOME_WITNESS_NOT_INDEPENDENT',
    });
  });

  it('rejects stale-cookie replay even when the evidence fingerprint looks valid', () => {
    const input = mission();
    const stale = proof(input, 'outcome', {
      continuityCookie: hash('old-cookie'),
    });
    const result = evaluateTrustTransition({ ...input, evidence: [stale] });

    expect(result.outcomeVerified).toBe(false);
    expect(result.rejectedEvidence).toContainEqual({
      plane: 'outcome',
      reason: 'IDENTITY_OR_COOKIE_MISMATCH',
    });
  });

  it('verifies only when execution and an independent same-cookie outcome witness are current', () => {
    const input = mission();
    const result = evaluateTrustTransition({
      ...input,
      evidence: [proof(input, 'execution'), proof(input, 'outcome')],
    });

    expect(result.valid).toBe(true);
    expect(result.executionVerified).toBe(true);
    expect(result.outcomeVerified).toBe(true);
    expect(result.currentTruthState).toBe('fresh');
    expect(result.disposition).toBe('verified');
    expect(result.selfAuthorize).toBe(false);
  });

  it('defines Attack 1000 as adversarial pressure, not a fabricated claim of 1000 external actions', () => {
    const result = evaluateTrustTransition(mission());
    expect(ATTACK_1000_PRESSURE_BUDGET).toBe(1000);
    expect(ATTACK_1000_ATTACK_FAMILIES).toHaveLength(10);
    expect(result.attack1000.pressureBudget).toBe(1000);
    expect(result.attack1000.literalExternalActionsClaimed).toBe(0);
    expect(result.invariants.workflowTokensCannotExpandAuthority).toBe(true);
  });
});
