import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  createEffectorReceiptV1,
  createExecutionLeaseV1,
  evaluateExecutionAttemptV1,
  verifyEffectorLedgerV1,
} from './execution-authority.js';

const KEY = 'k'.repeat(64);
const CREDENTIAL = 'a'.repeat(64);
const INPUT = 'b'.repeat(64);
const LEASE_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const RECEIPT_ID = '55555555-5555-4555-8555-555555555555';

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function receiptCore(receipt) {
  return {
    contract: receipt.contract,
    receiptId: receipt.receiptId,
    leaseId: receipt.leaseId,
    attemptId: receipt.attemptId,
    subject: receipt.subject,
    action: receipt.action,
    inputDigest: receipt.inputDigest,
    outcome: receipt.outcome,
    issuerRole: receipt.issuerRole,
    credentialBinding: receipt.credentialBinding,
    previousReceiptHash: receipt.previousReceiptHash,
    decisionDigest: receipt.decisionDigest,
    observedAt: receipt.observedAt,
  };
}

function resign(receipt) {
  const receiptHash = createHash('sha256')
    .update(JSON.stringify(stableValue(receiptCore(receipt))))
    .digest('hex');
  const signature = createHmac('sha256', KEY).update(receiptHash).digest('hex');
  return { ...receipt, receiptHash, signature };
}

function lease() {
  return createExecutionLeaseV1({
    leaseId: LEASE_ID,
    subject: 'jussray/chief-ai-machine@candidate',
    allowedActions: ['test'],
    temporalInvariants: [],
    maxEffects: 2,
    effectorCredentialBinding: CREDENTIAL,
    issuedAt: '2026-08-31T19:00:00.000Z',
    expiresAt: '2026-08-31T20:00:00.000Z',
  });
}

function request(attemptId = ATTEMPT_ID) {
  return {
    attemptId,
    subject: 'jussray/chief-ai-machine@candidate',
    action: 'test',
    inputDigest: INPUT,
  };
}

describe('ProofMode execution authority fail-closed regressions', () => {
  it('denies a malformed non-array receipt ledger without throwing', () => {
    const result = evaluateExecutionAttemptV1({
      lease: lease(),
      request: request(),
      receipts: { forged: true },
      signingKey: KEY,
      now: '2026-08-31T19:05:00.000Z',
    });

    expect(result.allowed).toBe(false);
    expect(result.reasons).toContain('invalid_receipt_ledger');
    expect(() => createEffectorReceiptV1({
      lease: lease(),
      request: request(),
      receipts: 'not-a-ledger',
      signingKey: KEY,
      observedAt: '2026-08-31T19:05:00.000Z',
      receiptId: RECEIPT_ID,
    })).toThrow(/execution_denied:.*invalid_receipt_ledger/);
  });

  it('rejects canonical replay when an imported signed receipt uses UUID case and whitespace variants', () => {
    const executionLease = lease();
    const canonical = createEffectorReceiptV1({
      lease: executionLease,
      request: request(),
      receipts: [],
      signingKey: KEY,
      observedAt: '2026-08-31T19:05:00.000Z',
      receiptId: RECEIPT_ID,
    });
    const imported = resign({
      ...canonical,
      attemptId: `  ${ATTEMPT_ID.toUpperCase()}  `,
    });

    expect(verifyEffectorLedgerV1({
      lease: executionLease,
      receipts: [imported],
      signingKey: KEY,
    })).toEqual([]);

    const replay = evaluateExecutionAttemptV1({
      lease: executionLease,
      request: request(ATTEMPT_ID),
      receipts: [imported],
      signingKey: KEY,
      now: '2026-08-31T19:06:00.000Z',
    });
    expect(replay.allowed).toBe(false);
    expect(replay.reasons).toContain('duplicate_attempt');
  });
});