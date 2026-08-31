import { describe, expect, it } from 'vitest';
import {
  createOperatorContinuityReceiptV2,
  evaluateOperatorContinuityReceiptV2,
  operatorContinuityDimensionFingerprint,
  operatorContinuityFingerprintV2,
  operatorContinuityProvenanceDigestV2,
  validateOperatorContinuityReceiptV2,
} from './continuity-fingerprint.mjs';

const NOW = '2026-08-31T16:30:00.000Z';
const baseInput = {
  source: 'chatgpt',
  projectSlug: 'founder-control-room',
  repositoryFullName: 'jussray/founder-control-room',
  targetBranch: 'main',
  targetSha: 'a'.repeat(40),
  prNumber: 733,
  baseSha: 'b'.repeat(40),
  headSha: 'c'.repeat(40),
  scopeFingerprint: '1'.repeat(64),
  proofFingerprint: '2'.repeat(64),
  reviewFingerprint: '3'.repeat(64),
  providerFingerprint: '4'.repeat(64),
  runtimeFingerprint: '5'.repeat(64),
  authorityFingerprint: '6'.repeat(64),
  evidenceRefs: ['github:main-readback', 'github:pr-733'],
  observedAt: '2026-08-31T16:20:00.000Z',
  expiresAt: '2026-08-31T16:40:00.000Z',
  predecessorFingerprint: null,
};

function authenticatedProvenance(receipt, mechanism = 'authenticated-transport') {
  return {
    mechanism,
    source: receipt.source,
    provenanceDigest: receipt.provenanceDigest,
  };
}

describe('Chief operator continuity v2 mirror', () => {
  it('matches the FCR canonical v2 state vector', () => {
    expect(operatorContinuityFingerprintV2(baseInput)).toBe(
      '635568aadd9174633266a8332139575f86d7ed265f51095749cf692aafe69aea',
    );
  });

  it('keeps the same state vector across observer and provenance rotation', () => {
    expect(operatorContinuityFingerprintV2({
      ...baseInput,
      source: 'work',
      evidenceRefs: ['cloudflare:receipt:9766241316'],
      observedAt: '2026-08-31T16:29:00.000Z',
      expiresAt: '2026-08-31T16:49:00.000Z',
      predecessorFingerprint: '7'.repeat(64),
    })).toBe(operatorContinuityFingerprintV2(baseInput));
  });

  it('binds provenance metadata separately from the stable state fingerprint', () => {
    const receipt = createOperatorContinuityReceiptV2(baseInput);
    expect(receipt.provenanceDigest).toMatch(/^[0-9a-f]{64}$/);

    const mutations = [
      { evidenceRefs: ['github:forged-evidence'] },
      { observedAt: '2026-08-31T16:21:00.000Z' },
      { expiresAt: '2026-08-31T16:41:00.000Z' },
      { predecessorFingerprint: '7'.repeat(64) },
    ];

    for (const mutation of mutations) {
      const forged = { ...receipt, ...mutation };
      expect(forged.fingerprint).toBe(receipt.fingerprint);
      expect(validateOperatorContinuityReceiptV2(forged)).toContain(
        'operator continuity v2 provenance digest does not match bound receipt metadata',
      );
    }
  });

  it('does not treat a publicly recomputable provenance digest as authenticity', () => {
    const receipt = createOperatorContinuityReceiptV2(baseInput);
    const forged = {
      ...receipt,
      source: 'work',
      evidenceRefs: ['github:attacker-controlled-evidence'],
    };
    forged.provenanceDigest = operatorContinuityProvenanceDigestV2(forged);
    expect(validateOperatorContinuityReceiptV2(forged, NOW)).toEqual([]);

    const current = {
      ...baseInput,
      source: 'work',
      evidenceRefs: ['cloudflare:receipt:9766241316'],
      observedAt: '2026-08-31T16:29:00.000Z',
      expiresAt: '2026-08-31T16:49:00.000Z',
    };

    const unauthenticated = evaluateOperatorContinuityReceiptV2(forged, current, NOW);
    expect(unauthenticated.state).toBe('invalid');
    expect(unauthenticated.reasons).toContain('provenance_unauthenticated');
    expect(unauthenticated.reacquireRequired).toBe(true);

    const authenticationBoundToDifferentDigest = evaluateOperatorContinuityReceiptV2(
      forged,
      current,
      NOW,
      authenticatedProvenance(receipt),
    );
    expect(authenticationBoundToDifferentDigest.state).toBe('invalid');
    expect(authenticationBoundToDifferentDigest.reasons).toContain('provenance_unauthenticated');
  });

  it('matches the canonical provider-observation vector', () => {
    expect(operatorContinuityDimensionFingerprint({
      provider: 'cloudflare',
      audit: 'authority',
      attempt: 2,
      jobId: '99560046321',
      state: 'queued',
      mutation: 'none',
    })).toBe('1a5507cb4afcde7281176b78d05e9b788a6f278672c1f196b1c0eb2f1d55171a');
  });

  it('accepts an unchanged fresh authenticated cross-operator receipt without granting authority', () => {
    const receipt = createOperatorContinuityReceiptV2(baseInput);
    expect(validateOperatorContinuityReceiptV2(receipt, NOW)).toEqual([]);
    expect(evaluateOperatorContinuityReceiptV2(receipt, {
      ...baseInput,
      source: 'work',
      evidenceRefs: ['cloudflare:receipt:9766241316'],
      observedAt: '2026-08-31T16:29:00.000Z',
      expiresAt: '2026-08-31T16:49:00.000Z',
      predecessorFingerprint: '7'.repeat(64),
    }, NOW, authenticatedProvenance(receipt))).toEqual({
      state: 'current',
      reasons: [],
      reacquireRequired: false,
      continuityMayAuthorizeAction: false,
    });
  });

  it('rejects a receipt before its claimed observation time', () => {
    const receipt = createOperatorContinuityReceiptV2({
      ...baseInput,
      observedAt: '2026-08-31T16:31:00.000Z',
      expiresAt: '2026-08-31T16:50:00.000Z',
    });

    expect(validateOperatorContinuityReceiptV2(receipt, NOW)).toContain(
      'operator continuity observedAt cannot be in the future',
    );

    const result = evaluateOperatorContinuityReceiptV2(
      receipt,
      baseInput,
      NOW,
      authenticatedProvenance(receipt),
    );
    expect(result.state).toBe('invalid');
    expect(result.reasons).toContain('observation_time_invalid');
    expect(result.continuityMayAuthorizeAction).toBe(false);
  });

  it('revokes inherited green on load-bearing state movement', () => {
    const receipt = createOperatorContinuityReceiptV2(baseInput);
    const variants = [
      [{ projectSlug: 'sekret-bip' }, 'project_moved'],
      [{ repositoryFullName: 'jussray/other' }, 'repository_moved'],
      [{ targetBranch: 'release' }, 'target_branch_moved'],
      [{ targetSha: 'd'.repeat(40) }, 'target_sha_moved'],
      [{ prNumber: 999 }, 'pr_moved'],
      [{ baseSha: 'd'.repeat(40) }, 'base_sha_moved'],
      [{ headSha: 'e'.repeat(40) }, 'head_sha_moved'],
      [{ scopeFingerprint: '7'.repeat(64) }, 'scope_moved'],
      [{ proofFingerprint: '8'.repeat(64) }, 'proof_moved'],
      [{ reviewFingerprint: '9'.repeat(64) }, 'review_moved'],
      [{ providerFingerprint: 'a'.repeat(64) }, 'provider_moved'],
      [{ runtimeFingerprint: 'b'.repeat(64) }, 'runtime_moved'],
      [{ authorityFingerprint: 'c'.repeat(64) }, 'authority_moved'],
    ];
    for (const [change, reason] of variants) {
      const result = evaluateOperatorContinuityReceiptV2(
        receipt,
        { ...baseInput, ...change },
        NOW,
        authenticatedProvenance(receipt),
      );
      expect(result.state, reason).toBe('stale');
      expect(result.reasons, reason).toContain(reason);
      expect(result.reacquireRequired, reason).toBe(true);
      expect(result.continuityMayAuthorizeAction, reason).toBe(false);
    }
  });

  it('models the Se’kret Bip Cloudflare rerun as new state despite unchanged main', () => {
    const attempt1Provider = operatorContinuityDimensionFingerprint({
      provider: 'cloudflare', audit: 'authority', attempt: 1, state: 'blocked', mutation: 'none',
    });
    const attempt2Provider = operatorContinuityDimensionFingerprint({
      provider: 'cloudflare', audit: 'authority', attempt: 2, jobId: '99560046321', state: 'queued', mutation: 'none',
    });
    const shared = {
      ...baseInput,
      projectSlug: 'sekret-bip',
      repositoryFullName: 'jussray/Sekret-Bip',
      targetSha: '0d26db9c77799bd99ba68db194bd6bd948ca4f37',
      prNumber: null,
      baseSha: null,
      headSha: null,
    };
    const receipt = createOperatorContinuityReceiptV2({
      ...shared,
      providerFingerprint: attempt1Provider,
      evidenceRefs: ['cloudflare:authority-audit:attempt-1'],
    });
    const result = evaluateOperatorContinuityReceiptV2(receipt, {
      ...shared,
      source: 'work',
      providerFingerprint: attempt2Provider,
      evidenceRefs: ['cloudflare:authority-audit:attempt-2', 'cloudflare:job:99560046321'],
    }, NOW, authenticatedProvenance(receipt));
    expect(result.state).toBe('stale');
    expect(result.reasons).toEqual(['provider_moved']);
  });

  it('fails closed on forged authority and expires receipts at their exact deadline', () => {
    const receipt = createOperatorContinuityReceiptV2(baseInput);
    const forged = { ...receipt, authorizing: true };
    const invalid = evaluateOperatorContinuityReceiptV2(
      forged,
      baseInput,
      NOW,
      authenticatedProvenance(forged),
    );
    expect(invalid.state).toBe('invalid');
    expect(invalid.reasons).toContain('receipt_invalid');
    expect(invalid.continuityMayAuthorizeAction).toBe(false);

    const atDeadline = evaluateOperatorContinuityReceiptV2(
      receipt,
      baseInput,
      baseInput.expiresAt,
      authenticatedProvenance(receipt),
    );
    expect(atDeadline.state).toBe('stale');
    expect(atDeadline.reasons).toContain('receipt_expired');

    const expired = evaluateOperatorContinuityReceiptV2(
      receipt,
      baseInput,
      '2026-08-31T16:40:00.001Z',
      authenticatedProvenance(receipt),
    );
    expect(expired.state).toBe('stale');
    expect(expired.reasons).toContain('receipt_expired');
  });
});