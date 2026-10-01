import { describe, expect, it } from 'vitest';
import { evaluateMergeReview } from './evidence-decision-loop.js';

const head = 'exact-head';

describe('Evidence Decision Loop as-is ruleset mode', () => {
  it('diagnoses a governance deadlock without suggesting ruleset mutation or bypass', () => {
    const result = evaluateMergeReview({
      requested: true,
      currentHeadSha: head,
      reviewedHeadSha: head,
      requiredChecks: ['Verify production ProofMode MCP with Playwright'],
      checkRuns: [],
      rules: {
        rulesetMode: 'as-is',
        codeScanningRequired: false,
        founderSelfAuditRequired: true,
        requireLastPushApproval: true,
        soleFounderMode: true,
        independentReviewAvailable: false,
        postMergeOnlyChecks: ['Verify production ProofMode MCP with Playwright'],
      },
      founderActor: 'jussray',
      founderSelfAudit: {
        completed: true,
        reviewer: 'jussray',
        reviewedHeadSha: head,
        disposition: 'ACCEPT',
        diffReviewed: true,
        requiredChecksReviewed: true,
        codeScanningReviewed: true,
        runtimeEvidenceReviewed: true,
        knownRisksReviewed: true,
      },
      lastPusher: 'jussray',
      founderAuthorityExplicit: true,
      founderAuthorityHeadSha: head,
    });

    expect(result.disposition).toBe('GOVERNANCE_DEADLOCK');
    expect(result.rulesetMode).toBe('as-is');
    expect(result.safeRulesetDelta).toBeNull();
    expect(result.rulesetMutationSuggested).toBe(false);
    expect(result.missingRequiredChecks).toEqual(['Verify production ProofMode MCP with Playwright']);
    expect(result.bypassSuggested).toBe(false);
    expect(result.mergeAllowed).toBe(false);
  });
});
