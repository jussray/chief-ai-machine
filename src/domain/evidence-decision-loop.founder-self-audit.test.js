import { describe, expect, it } from 'vitest';
import { evaluateMergeReview } from './evidence-decision-loop.js';

const head = '7571961d2eff18fa09ff42b1bab54fbec4aebd0a';
const founder = 'jussray';

function acceptedFounderAudit(reviewedHeadSha = head, overrides = {}) {
  return {
    completed: true,
    reviewer: founder,
    reviewedHeadSha,
    disposition: 'ACCEPT',
    diffReviewed: true,
    requiredChecksReviewed: true,
    codeScanningReviewed: true,
    runtimeEvidenceReviewed: true,
    knownRisksReviewed: true,
    ...overrides,
  };
}

function reviewInput(overrides = {}) {
  return {
    requested: true,
    currentHeadSha: head,
    reviewedHeadSha: head,
    requiredChecks: [],
    checkRuns: [],
    rules: {
      founderSelfAuditRequired: true,
      codeScanningRequired: false,
      requiredLinearHistory: true,
      allowedMergeMethods: ['squash', 'rebase'],
    },
    founderActor: founder,
    lastPusher: founder,
    founderAuthorityExplicit: true,
    ...overrides,
  };
}

describe('Founder Self-Audit exact-head gate', () => {
  it('holds when sole-founder review evidence is required but missing', () => {
    const result = evaluateMergeReview(reviewInput());

    expect(result.disposition).toBe('WAIT_FOUNDER_SELF_AUDIT');
    expect(result.founderSelfAuditRequired).toBe(true);
    expect(result.founderSelfAuditSatisfied).toBe(false);
    expect(result.mergeAllowed).toBe(false);
  });

  it('accepts a complete exact-head founder self-audit without pretending it is independent review', () => {
    const result = evaluateMergeReview(reviewInput({ founderSelfAudit: acceptedFounderAudit() }));

    expect(result.disposition).toBe('READY');
    expect(result.founderSelfAuditSatisfied).toBe(true);
    expect(result.founderSelfAuditHeadMatches).toBe(true);
    expect(result.independentApprovalSatisfied).toBe(true);
    expect(result.selfAuthorize).toBe(false);
    expect(result.bypassSuggested).toBe(false);
  });

  it('expires founder self-audit evidence after head movement', () => {
    const result = evaluateMergeReview(reviewInput({
      founderSelfAudit: acceptedFounderAudit('old-head'),
    }));

    expect(result.disposition).toBe('WAIT_FOUNDER_SELF_AUDIT');
    expect(result.founderSelfAuditHeadMatches).toBe(false);
    expect(result.founderSelfAuditSatisfied).toBe(false);
  });

  it('requires explicit merge authority even after a successful founder self-audit', () => {
    const result = evaluateMergeReview(reviewInput({
      founderSelfAudit: acceptedFounderAudit(),
      founderAuthorityExplicit: false,
    }));

    expect(result.founderSelfAuditSatisfied).toBe(true);
    expect(result.disposition).toBe('WAIT_FOUNDER_AUTHORITY');
    expect(result.mergeAllowed).toBe(false);
  });

  it('does not let founder self-audit satisfy an independent last-push approval rule', () => {
    const result = evaluateMergeReview(reviewInput({
      rules: {
        founderSelfAuditRequired: true,
        codeScanningRequired: false,
        requireLastPushApproval: true,
        requiredLinearHistory: true,
        allowedMergeMethods: ['squash', 'rebase'],
      },
      founderSelfAudit: acceptedFounderAudit(),
      independentApproval: { approved: true, reviewer: founder },
    }));

    expect(result.founderSelfAuditSatisfied).toBe(true);
    expect(result.independentApprovalSatisfied).toBe(false);
    expect(result.disposition).toBe('WAIT_INDEPENDENT_APPROVAL');
    expect(result.mergeAllowed).toBe(false);
  });

  it('treats REVISE or HOLD as a failed self-audit gate even when every evidence checkbox is true', () => {
    for (const disposition of ['REVISE', 'HOLD']) {
      const result = evaluateMergeReview(reviewInput({
        founderSelfAudit: acceptedFounderAudit(head, { disposition }),
      }));

      expect(result.founderSelfAuditSatisfied).toBe(false);
      expect(result.disposition).toBe('WAIT_FOUNDER_SELF_AUDIT');
    }
  });

  it('rejects a self-audit receipt attributed to someone other than the configured founder actor', () => {
    const result = evaluateMergeReview(reviewInput({
      founderSelfAudit: acceptedFounderAudit(head, { reviewer: 'someone-else' }),
    }));

    expect(result.founderSelfAuditSatisfied).toBe(false);
    expect(result.disposition).toBe('WAIT_FOUNDER_SELF_AUDIT');
  });

  it('requires the founder to review every declared evidence surface before accepting the receipt', () => {
    const result = evaluateMergeReview(reviewInput({
      founderSelfAudit: acceptedFounderAudit(head, { runtimeEvidenceReviewed: false }),
    }));

    expect(result.founderSelfAuditCoverageSatisfied).toBe(false);
    expect(result.founderSelfAuditSatisfied).toBe(false);
    expect(result.disposition).toBe('WAIT_FOUNDER_SELF_AUDIT');
  });
});
