import { describe, expect, it } from 'vitest';
import { evaluateEvidenceDecision, evaluateMergeReview } from './evidence-decision-loop.js';

const fingerprint = 'f7ed2e6122c44b137cdf6686e692515c324ff925';

function evidence(plane, state = 'VERIFIED', ref = 'https://example.com/proof') {
  return { plane, state, ref };
}

function successfulCheck(name, headSha = fingerprint) {
  return { name, headSha, status: 'completed', conclusion: 'success' };
}

const REQUIRED_MERGE_CHECKS = [
  'Publish exact-head test ledger',
  'Redacted provider receipt',
  'Typecheck',
  'Verify Founder Goals desktop and mobile flow',
  'Verify Freestyle, Goalfix, and PromptOS in Chromium',
  'Verify exact Chief runtime with Playwright',
  'Verify live Chief capability plan with Playwright',
  'Verify live ProofMode MCP with Playwright',
  'Verify operational authority',
  'Verify production ProofMode MCP with Playwright',
];

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

  it('holds merge review when a required check did not materialize on the reviewed head', () => {
    const result = evaluateMergeReview({
      requested: true,
      currentHeadSha: fingerprint,
      reviewedHeadSha: fingerprint,
      requiredChecks: REQUIRED_MERGE_CHECKS,
      checkRuns: REQUIRED_MERGE_CHECKS.slice(0, -1).map((name) => successfulCheck(name)),
      rules: { codeScanningRequired: false },
      founderAuthorityExplicit: true,
      founderAuthorityHeadSha: fingerprint,
    });

    expect(result.disposition).toBe('WAIT_REQUIRED_CHECKS');
    expect(result.missingRequiredChecks).toEqual(['Verify production ProofMode MCP with Playwright']);
    expect(result.mergeAllowed).toBe(false);
  });

  it('treats CodeQL as separate merge evidence even when required status checks are green', () => {
    const result = evaluateMergeReview({
      requested: true,
      currentHeadSha: fingerprint,
      reviewedHeadSha: fingerprint,
      requiredChecks: REQUIRED_MERGE_CHECKS,
      checkRuns: REQUIRED_MERGE_CHECKS.map((name) => successfulCheck(name)),
      rules: { codeScanningRequired: true, codeScanningTool: 'CodeQL' },
      founderAuthorityExplicit: true,
      founderAuthorityHeadSha: fingerprint,
    });

    expect(result.disposition).toBe('WAIT_CODE_SCANNING');
    expect(result.codeScanningSatisfied).toBe(false);
    expect(result.mergeAllowed).toBe(false);
  });

  it('treats required deployment environments as separate exact-head merge evidence', () => {
    const checks = [...REQUIRED_MERGE_CHECKS.map((name) => successfulCheck(name)), successfulCheck('CodeQL')];
    const result = evaluateMergeReview({
      requested: true,
      currentHeadSha: fingerprint,
      reviewedHeadSha: fingerprint,
      requiredChecks: REQUIRED_MERGE_CHECKS,
      checkRuns: checks,
      rules: {
        codeScanningRequired: true,
        codeScanningTool: 'CodeQL',
        requiredDeployments: ['Cloudflare Production', 'proofmode-access-admin'],
      },
      deploymentStatuses: [
        { environment: 'Cloudflare Production', headSha: fingerprint, state: 'success' },
        { environment: 'proofmode-access-admin', headSha: 'old-head', state: 'success' },
      ],
      founderAuthorityExplicit: true,
      founderAuthorityHeadSha: fingerprint,
    });

    expect(result.disposition).toBe('WAIT_REQUIRED_DEPLOYMENTS');
    expect(result.missingRequiredDeployments).toEqual(['proofmode-access-admin']);
    expect(result.requiredDeploymentsSatisfied).toBe(false);
  });

  it('cannot self-satisfy a last-push approval rule', () => {
    const checks = [...REQUIRED_MERGE_CHECKS.map((name) => successfulCheck(name)), successfulCheck('CodeQL')];
    const result = evaluateMergeReview({
      requested: true,
      currentHeadSha: fingerprint,
      reviewedHeadSha: fingerprint,
      requiredChecks: REQUIRED_MERGE_CHECKS,
      checkRuns: checks,
      rules: {
        codeScanningRequired: true,
        codeScanningTool: 'CodeQL',
        requireLastPushApproval: true,
      },
      lastPusher: 'jussray',
      independentApproval: { approved: true, reviewer: 'jussray', reviewedHeadSha: fingerprint },
      founderAuthorityExplicit: true,
      founderAuthorityHeadSha: fingerprint,
    });

    expect(result.disposition).toBe('WAIT_INDEPENDENT_APPROVAL');
    expect(result.independentApprovalSatisfied).toBe(false);
    expect(result.selfAuthorize).toBe(false);
    expect(result.bypassSuggested).toBe(false);
  });

  it('selects squash instead of retrying a forbidden merge commit under linear history', () => {
    const checks = [...REQUIRED_MERGE_CHECKS.map((name) => successfulCheck(name)), successfulCheck('CodeQL')];
    const result = evaluateMergeReview({
      requested: true,
      currentHeadSha: fingerprint,
      reviewedHeadSha: fingerprint,
      requiredChecks: REQUIRED_MERGE_CHECKS,
      checkRuns: checks,
      rules: {
        codeScanningRequired: true,
        codeScanningTool: 'CodeQL',
        requireLastPushApproval: true,
        requiredLinearHistory: true,
        allowedMergeMethods: ['merge', 'squash', 'rebase'],
        requiredDeployments: ['Cloudflare Production', 'proofmode-access-admin'],
      },
      deploymentStatuses: [
        { environment: 'Cloudflare Production', headSha: fingerprint, state: 'success' },
        { environment: 'proofmode-access-admin', headSha: fingerprint, state: 'success' },
      ],
      requestedMethod: 'merge',
      lastPusher: 'jussray',
      independentApproval: { approved: true, reviewer: 'independent-reviewer', reviewedHeadSha: fingerprint },
      founderAuthorityExplicit: true,
      founderAuthorityHeadSha: fingerprint,
    });

    expect(result.disposition).toBe('READY');
    expect(result.recommendedMergeMethod).toBe('squash');
    expect(result.mergeAllowed).toBe(true);
  });

  it('expires merge authority and review proof after head movement', () => {
    const result = evaluateEvidenceDecision({
      subjectFingerprint: 'new-head',
      mergeReview: {
        requested: true,
        currentHeadSha: 'new-head',
        reviewedHeadSha: 'old-head',
        requiredChecks: [],
        checkRuns: [],
        founderAuthorityExplicit: true,
        founderAuthorityHeadSha: 'old-head',
      },
    });

    expect(result.mergeReview.disposition).toBe('REOBSERVE');
    expect(result.mergeReview.mergeAllowed).toBe(false);
    expect(result.recommendation).toBe('REOBSERVE');
  });

  it('requires current founder merge authority even after checks and independent review are green', () => {
    const checks = [...REQUIRED_MERGE_CHECKS.map((name) => successfulCheck(name)), successfulCheck('CodeQL')];
    const result = evaluateMergeReview({
      requested: true,
      currentHeadSha: fingerprint,
      reviewedHeadSha: fingerprint,
      requiredChecks: REQUIRED_MERGE_CHECKS,
      checkRuns: checks,
      rules: {
        codeScanningRequired: true,
        codeScanningTool: 'CodeQL',
        requireLastPushApproval: true,
        requiredLinearHistory: true,
        allowedMergeMethods: ['squash', 'rebase'],
        requiredDeployments: ['Cloudflare Production', 'proofmode-access-admin'],
      },
      deploymentStatuses: [
        { environment: 'Cloudflare Production', headSha: fingerprint, state: 'success' },
        { environment: 'proofmode-access-admin', headSha: fingerprint, state: 'success' },
      ],
      lastPusher: 'jussray',
      independentApproval: { approved: true, reviewer: 'independent-reviewer', reviewedHeadSha: fingerprint },
      founderAuthorityExplicit: false,
      founderAuthorityHeadSha: fingerprint,
    });

    expect(result.disposition).toBe('WAIT_FOUNDER_AUTHORITY');
    expect(result.mergeAllowed).toBe(false);
  });
});
