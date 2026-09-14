import { describe, expect, it } from 'vitest';
import {
  createEffectorReceiptV1,
  createExecutionLeaseV1,
  evaluateExecutionAttemptV1,
  verifyEffectorLedgerV1,
} from './execution-authority.js';

const KEY = 'k'.repeat(64);
const CREDENTIAL = 'a'.repeat(64);
const INPUT_A = 'b'.repeat(64);
const INPUT_B = 'c'.repeat(64);
const LEASE_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_TEST = '22222222-2222-4222-8222-222222222222';
const ATTEMPT_DEPLOY = '33333333-3333-4333-8333-333333333333';
const ATTEMPT_EXTRA = '44444444-4444-4444-8444-444444444444';
const RECEIPT_TEST = '55555555-5555-4555-8555-555555555555';
const RECEIPT_DEPLOY = '66666666-6666-4666-8666-666666666666';

function lease(overrides = {}) {
  return createExecutionLeaseV1({
    leaseId: LEASE_ID,
    subject: 'jussray/chief-ai-machine@candidate',
    allowedActions: ['test', 'deploy'],
    temporalInvariants: [{ action: 'deploy', requiresPriorAction: 'test' }],
    maxEffects: 2,
    effectorCredentialBinding: CREDENTIAL,
    issuedAt: '2026-08-31T19:00:00.000Z',
    expiresAt: '2026-08-31T20:00:00.000Z',
    ...overrides,
  });
}

function request(attemptId, action, inputDigest = INPUT_A) {
  return {
    attemptId,
    subject: 'jussray/chief-ai-machine@candidate',
    action,
    inputDigest,
  };
}

describe('ProofMode bounded execution authority', () => {
  it('requires temporal prerequisites and produces effector-owned chained evidence', () => {
    const executionLease = lease();
    const deployBeforeTest = evaluateExecutionAttemptV1({
      lease: executionLease,
      request: request(ATTEMPT_DEPLOY, 'deploy', INPUT_B),
      receipts: [],
      signingKey: KEY,
      now: '2026-08-31T19:05:00.000Z',
    });
    expect(deployBeforeTest.allowed).toBe(false);
    expect(deployBeforeTest.reasons).toContain('missing_prior_action:test');
    expect(deployBeforeTest.continuityMayAuthorizeAction).toBe(false);

    const testReceipt = createEffectorReceiptV1({
      lease: executionLease,
      request: request(ATTEMPT_TEST, 'test'),
      receipts: [],
      signingKey: KEY,
      observedAt: '2026-08-31T19:06:00.000Z',
      receiptId: RECEIPT_TEST,
    });
    expect(testReceipt.issuerRole).toBe('effector');
    expect(testReceipt.previousReceiptHash).toBeNull();

    const deployReceipt = createEffectorReceiptV1({
      lease: executionLease,
      request: request(ATTEMPT_DEPLOY, 'deploy', INPUT_B),
      receipts: [testReceipt],
      signingKey: KEY,
      observedAt: '2026-08-31T19:07:00.000Z',
      receiptId: RECEIPT_DEPLOY,
    });
    expect(deployReceipt.previousReceiptHash).toBe(testReceipt.receiptHash);
    expect(verifyEffectorLedgerV1({
      lease: executionLease,
      receipts: [testReceipt, deployReceipt],
      signingKey: KEY,
    })).toEqual([]);
  });

  it('rejects stale leases, unleased actions, duplicate attempts, and effect-budget overruns', () => {
    const executionLease = lease();
    const stale = evaluateExecutionAttemptV1({
      lease: executionLease,
      request: request(ATTEMPT_TEST, 'test'),
      receipts: [],
      signingKey: KEY,
      now: '2026-08-31T20:00:00.000Z',
    });
    expect(stale.allowed).toBe(false);
    expect(stale.reasons).toContain('lease_expired');

    const unleased = evaluateExecutionAttemptV1({
      lease: executionLease,
      request: request(ATTEMPT_TEST, 'publish'),
      receipts: [],
      signingKey: KEY,
      now: '2026-08-31T19:05:00.000Z',
    });
    expect(unleased.allowed).toBe(false);
    expect(unleased.reasons).toContain('action_not_allowed');

    const first = createEffectorReceiptV1({
      lease: executionLease,
      request: request(ATTEMPT_TEST, 'test'),
      receipts: [],
      signingKey: KEY,
      observedAt: '2026-08-31T19:06:00.000Z',
      receiptId: RECEIPT_TEST,
    });
    const duplicate = evaluateExecutionAttemptV1({
      lease: executionLease,
      request: request(ATTEMPT_TEST, 'test'),
      receipts: [first],
      signingKey: KEY,
      now: '2026-08-31T19:07:00.000Z',
    });
    expect(duplicate.allowed).toBe(false);
    expect(duplicate.reasons).toContain('duplicate_attempt');

    const second = createEffectorReceiptV1({
      lease: executionLease,
      request: request(ATTEMPT_DEPLOY, 'deploy', INPUT_B),
      receipts: [first],
      signingKey: KEY,
      observedAt: '2026-08-31T19:07:00.000Z',
      receiptId: RECEIPT_DEPLOY,
    });
    const overBudget = evaluateExecutionAttemptV1({
      lease: executionLease,
      request: request(ATTEMPT_EXTRA, 'test'),
      receipts: [first, second],
      signingKey: KEY,
      now: '2026-08-31T19:08:00.000Z',
    });
    expect(overBudget.allowed).toBe(false);
    expect(overBudget.reasons).toContain('max_effects_reached');
  });

  it('rejects transcript-style receipt tampering and fake issuer roles', () => {
    const executionLease = lease();
    const receipt = createEffectorReceiptV1({
      lease: executionLease,
      request: request(ATTEMPT_TEST, 'test'),
      receipts: [],
      signingKey: KEY,
      observedAt: '2026-08-31T19:06:00.000Z',
      receiptId: RECEIPT_TEST,
    });

    const tampered = { ...receipt, action: 'deploy' };
    const tamperErrors = verifyEffectorLedgerV1({
      lease: executionLease,
      receipts: [tampered],
      signingKey: KEY,
    });
    expect(tamperErrors).toContain('receipt_0_hash_invalid');
    expect(tamperErrors).toContain('receipt_0_signature_invalid');
    expect(tamperErrors).toContain('receipt_0_temporal_invariant_failed');

    const fakeIssuer = { ...receipt, issuerRole: 'planner' };
    const issuerErrors = verifyEffectorLedgerV1({
      lease: executionLease,
      receipts: [fakeIssuer],
      signingKey: KEY,
    });
    expect(issuerErrors).toContain('receipt_0_issuer_not_effector');
    expect(issuerErrors).toContain('receipt_0_hash_invalid');
  });

  it('does not mint an effect receipt for a denied request', () => {
    const executionLease = lease();
    expect(() => createEffectorReceiptV1({
      lease: executionLease,
      request: request(ATTEMPT_DEPLOY, 'deploy', INPUT_B),
      receipts: [],
      signingKey: KEY,
      observedAt: '2026-08-31T19:05:00.000Z',
      receiptId: RECEIPT_DEPLOY,
    })).toThrow('execution_denied:missing_prior_action:test');
  });
});
