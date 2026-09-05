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

  it('treats a different answer as an investigation trigger instead of an automatic error', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: fingerprint,
      evidence: [evidence('execution')],
      divergence: {
        observed: true,
        assumptions: ['The request uses a different definition of success.'],
        falsifier: 'Primary-source evidence proves both parties used the same definition.',
      },
    });

    expect(result.divergence.disposition).toBe('TEST_ALTERNATIVE');
    expect(result.divergence.reconstructable).toBe(true);
    expect(result.recommendation).toBe('INVESTIGATE_DIVERGENCE');
    expect(result.invariants.differenceIsNotAutomaticallyError).toBe(true);
  });

  it('does not upgrade an alternative reasoning path without verified resolution evidence', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: fingerprint,
      divergence: {
        observed: true,
        assumptions: ['A hidden variable changes the applicable rule.'],
        falsifier: 'The hidden variable is absent.',
        resolution: 'candidate',
        resolutionEvidence: [{ state: 'OBSERVED', ref: 'https://example.com/observation' }],
      },
    });

    expect(result.divergence.disposition).toBe('TEST_ALTERNATIVE');
    expect(result.divergence.resolution).toBe('unresolved');
    expect(result.divergence.verifiedResolution).toBe(false);
  });

  it('allows verified evidence to resolve divergence without self-authorizing action', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: fingerprint,
      divergence: {
        observed: true,
        assumptions: ['A hidden variable changes the applicable rule.'],
        falsifier: 'The hidden variable is absent.',
        resolution: 'both-contextual',
        resolutionEvidence: [{ state: 'VERIFIED', ref: 'https://example.com/primary-proof' }],
      },
      consequentialAction: true,
    });

    expect(result.divergence.disposition).toBe('RESOLVED');
    expect(result.divergence.resolution).toBe('both-contextual');
    expect(result.selfAuthorize).toBe(false);
    expect(result.founderReviewRequired).toBe(true);
  });

  it('rejects reasoning paths that attempt to cross safety or authority boundaries', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: fingerprint,
      divergence: {
        observed: true,
        assumptions: ['Bypassing the authority check would make the candidate answer work.'],
        falsifier: 'The authority boundary is actually optional.',
        authorityViolation: true,
      },
    });

    expect(result.divergence.disposition).toBe('REJECTED_BOUNDARY');
    expect(result.divergence.boundaryBlocked).toBe(true);
    expect(result.invariants.safetyAndAuthorityCannotBeReasonedAround).toBe(true);
  });
});
