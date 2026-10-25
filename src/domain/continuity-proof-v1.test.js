import { describe, expect, it } from 'vitest';
import { evaluateContinuityTransition } from './continuity-proof-v1.js';

const head = 'be0c29e777801d484dc6ad624345f34357d57081';

function verified(ref = 'https://example.com/proof') {
  return [{ state: 'VERIFIED', ref }];
}

function approval(action, subjectFingerprint = head) {
  return {
    explicit: true,
    subjectFingerprint,
    allowedActions: [action],
  };
}

describe('Continuity Proof v1', () => {
  it('invalidates an incoming proof cookie when a bound runtime fingerprint changes', () => {
    const result = evaluateContinuityTransition({
      subjectFingerprint: head,
      currentBindings: { runtimeFingerprint: 'runtime-new' },
      proofCookie: {
        id: 'cookie-old',
        subjectFingerprint: head,
        runtimeFingerprint: 'runtime-old',
      },
      evidence: verified(),
      action: { kind: 'fix' },
      founderApproval: approval('fix'),
    });

    expect(result.cookieStale).toBe(true);
    expect(result.invalidationReasons).toContain('runtimeFingerprint changed');
    expect(result.mayAct).toBe(false);
    expect(result.invariants.evidenceOutranksContinuity).toBe(true);
  });

  it('does not let verified evidence self-authorize a mutation', () => {
    const result = evaluateContinuityTransition({
      subjectFingerprint: head,
      evidence: verified(),
      action: { kind: 'merge' },
    });

    expect(result.verifiedEvidence).toBe(true);
    expect(result.approvalMatches).toBe(false);
    expect(result.mayAct).toBe(false);
    expect(result.selfAuthorize).toBe(false);
    expect(result.cookieGrantsAuthority).toBe(false);
  });

  it('allows verified evidence to advance an exactly approved focused action', () => {
    const result = evaluateContinuityTransition({
      subjectFingerprint: head,
      evidence: verified('https://example.com/exact-head-playwright'),
      action: { kind: 'fix' },
      founderApproval: approval('fix'),
    });

    expect(result.cookieStale).toBe(false);
    expect(result.approvalMatches).toBe(true);
    expect(result.mayAct).toBe(true);
    expect(result.emitFreshCookie).toBe(false);
  });

  it('emits a refreshed proof cookie only after the approved action executes and outcome is verified', () => {
    const result = evaluateContinuityTransition({
      subjectFingerprint: head,
      currentBindings: {
        authorityFingerprint: 'founder-approval-v1',
        runtimeFingerprint: 'runtime-exact-head',
        evidenceFingerprint: 'playwright-green',
        outcomeFingerprint: 'access-accepted',
        approvalFingerprint: 'approval-exact-head',
      },
      proofCookie: {
        id: 'cookie-predecessor',
        subjectFingerprint: head,
        receiptRefs: ['https://example.com/source-proof'],
      },
      evidence: verified('https://example.com/playwright-proof'),
      action: {
        kind: 'rectify',
        executed: true,
        outcomeVerified: true,
        receiptRef: 'https://example.com/provider-receipt',
      },
      founderApproval: approval('rectify'),
    });

    expect(result.mayAct).toBe(true);
    expect(result.emitFreshCookie).toBe(true);
    expect(result.nextProofCookie).toMatchObject({
      contract: 'juss/continuity-proof@v1',
      state: 'VERIFIED',
      subjectFingerprint: head,
      action: 'rectify',
      supersedes: 'cookie-predecessor',
    });
    expect(result.nextProofCookie.receiptRefs).toEqual([
      'https://example.com/source-proof',
      'https://example.com/playwright-proof',
      'https://example.com/provider-receipt',
    ]);
  });

  it('expires prior approval after subject fingerprint movement', () => {
    const result = evaluateContinuityTransition({
      subjectFingerprint: 'new-head',
      proofCookie: { id: 'old-cookie', subjectFingerprint: head },
      evidence: verified(),
      action: { kind: 'merge' },
      founderApproval: approval('merge', head),
    });

    expect(result.cookieStale).toBe(true);
    expect(result.invalidationReasons).toContain('subjectFingerprint changed');
    expect(result.approvalMatches).toBe(false);
    expect(result.mayAct).toBe(false);
  });

  it('rejects credentials or secrets embedded inside proof cookies', () => {
    const result = evaluateContinuityTransition({
      subjectFingerprint: head,
      proofCookie: {
        subjectFingerprint: head,
        credential: 'must-not-live-here',
      },
      evidence: verified(),
      action: { kind: 'use' },
      founderApproval: approval('use'),
    });

    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('proofCookie must be non-secret');
    expect(result.mayAct).toBe(false);
  });
});
