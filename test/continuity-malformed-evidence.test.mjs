import { describe, expect, it } from 'vitest';
import {
  createOperatorContinuityReceiptV2,
  evaluateOperatorContinuityReceiptV2,
  validateOperatorContinuityReceiptV2,
} from '../scripts/continuity-fingerprint.mjs';

const baseInput = {
  source: 'chatgpt',
  projectSlug: 'chief-ai',
  repositoryFullName: 'jussray/chief-ai-machine',
  targetBranch: 'main',
  targetSha: 'a'.repeat(40),
  prNumber: 143,
  baseSha: 'b'.repeat(40),
  headSha: 'c'.repeat(40),
  scopeFingerprint: '1'.repeat(64),
  proofFingerprint: '2'.repeat(64),
  reviewFingerprint: '3'.repeat(64),
  providerFingerprint: '4'.repeat(64),
  runtimeFingerprint: '5'.repeat(64),
  authorityFingerprint: '6'.repeat(64),
  evidenceRefs: ['github:pr-143'],
  observedAt: '2026-09-05T06:00:00.000Z',
  expiresAt: '2026-09-05T07:00:00.000Z',
  predecessorFingerprint: null,
};

describe('operator continuity malformed evidence fail-closed behavior', () => {
  it.each(['github:forged', { ref: 'github:forged' }])(
    'rejects non-array evidenceRefs without throwing (%j)',
    (evidenceRefs) => {
      const receipt = createOperatorContinuityReceiptV2(baseInput);
      const malformed = { ...receipt, evidenceRefs };

      expect(() => validateOperatorContinuityReceiptV2(malformed)).not.toThrow();
      expect(validateOperatorContinuityReceiptV2(malformed)).toContain('evidenceRefs must be an array');

      const result = evaluateOperatorContinuityReceiptV2(
        malformed,
        baseInput,
        '2026-09-05T06:30:00.000Z',
        {
          mechanism: 'authenticated-transport',
          source: malformed.source,
          provenanceDigest: malformed.provenanceDigest,
        },
      );

      expect(result.state).toBe('invalid');
      expect(result.reasons).toContain('receipt_invalid');
      expect(result.reacquireRequired).toBe(true);
      expect(result.continuityMayAuthorizeAction).toBe(false);
    },
  );
});
