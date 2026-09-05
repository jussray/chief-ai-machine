import { describe, expect, it } from 'vitest';
import { evaluateEvidenceDecision } from './evidence-decision-loop.js';

const fingerprint = 'f7ed2e6122c44b137cdf6686e692515c324ff925';

function evidence(plane, state = 'VERIFIED', ref = 'https://example.com/proof') {
  return { plane, state, ref };
}

describe('Evidence Decision Loop v1', () => {
  it('does not confuse verified execution with verified outcome', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: fingerprint,
      evidence: [evidence('execution')],
      signals: { primary: 'unknown', secondary: 'improved' },
    });

    expect(result.claimState).toBe('OBSERVED');
    expect(result.outcomeVerified).toBe(false);
    expect(result.winnerAllowed).toBe(false);
    expect(result.recommendation).toBe('MEASURE');
  });

  it('forbids a winner from secondary signals alone', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: fingerprint,
      evidence: [evidence('execution')],
      signals: { primary: 'unknown', secondary: 'improved' },
    });

    expect(result.winnerAllowed).toBe(false);
  });

  it('invalidates predecessor proof when the bound subject changes', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: 'new-head',
      expectedFingerprint: 'old-head',
      evidence: [evidence('outcome')],
      signals: { primary: 'improved' },
    });

    expect(result.subjectChanged).toBe(true);
    expect(result.claimState).toBe('UNKNOWN');
    expect(result.recommendation).toBe('REOBSERVE');
    expect(result.winnerAllowed).toBe(false);
  });

  it('allows only a proposal after verified primary outcome evidence', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: fingerprint,
      evidence: [evidence('execution'), evidence('outcome')],
      signals: { primary: 'improved', secondary: 'improved' },
      consequentialAction: true,
    });

    expect(result.claimState).toBe('VERIFIED');
    expect(result.winnerAllowed).toBe(true);
    expect(result.recommendation).toBe('PROPOSE_KEEP');
    expect(result.selfAuthorize).toBe(false);
    expect(result.founderReviewRequired).toBe(true);
  });
});
