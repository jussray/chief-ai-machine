export const EVIDENCE_DECISION_LOOP_CONTRACT = 'juss/evidence-decision-loop@v1';

export const EVIDENCE_PLANES = Object.freeze(['source', 'execution', 'outcome']);
export const CLAIM_STATES = Object.freeze(['VERIFIED', 'OBSERVED', 'INFERRED', 'UNKNOWN', 'BLOCKED']);
export const DIVERGENCE_DISPOSITIONS = Object.freeze([
  'NONE',
  'REJECTED_BOUNDARY',
  'NEEDS_RECONSTRUCTION',
  'TEST_ALTERNATIVE',
  'RESOLVED',
]);
export const DIVERGENCE_RESOLUTIONS = Object.freeze([
  'expected',
  'candidate',
  'both-contextual',
  'neither',
  'unresolved',
]);
export const MERGE_REVIEW_DISPOSITIONS = Object.freeze([
  'NOT_APPLICABLE',
  'REOBSERVE',
  'WAIT_REQUIRED_CHECKS',
  'WAIT_CODE_SCANNING',
  'WAIT_REQUIRED_DEPLOYMENTS',
  'WAIT_INDEPENDENT_APPROVAL',
  'WAIT_FOUNDER_AUTHORITY',
  'HOLD_METHOD',
  'READY',
]);

function normalizeEvidence(evidence) {
  return Array.isArray(evidence) ? evidence : [];
}

function hasVerifiedPlane(evidence, plane) {
  return evidence.some((item) => item?.plane === plane && item?.state === 'VERIFIED' && item?.ref);
}

function bestNonVerifiedState(evidence) {
  if (evidence.some((item) => item?.state === 'BLOCKED')) return 'BLOCKED';
  if (evidence.some((item) => item?.state === 'OBSERVED')) return 'OBSERVED';
  if (evidence.some((item) => item?.state === 'INFERRED')) return 'INFERRED';
  return 'UNKNOWN';
}

function evaluateDivergence(divergence = {}) {
  const observed = divergence?.observed === true;
  if (!observed) {
    return {
      observed: false,
      reviewRequired: false,
      disposition: 'NONE',
      resolution: 'unresolved',
      reconstructable: false,
      assumptions: [],
      falsifier: null,
      errors: [],
    };
  }

  const assumptions = Array.isArray(divergence.assumptions)
    ? divergence.assumptions.filter((item) => typeof item === 'string' && item.trim())
    : [];
  const falsifier = typeof divergence.falsifier === 'string' && divergence.falsifier.trim()
    ? divergence.falsifier.trim()
    : null;
  const resolutionEvidence = normalizeEvidence(divergence.resolutionEvidence);
  const requestedResolution = DIVERGENCE_RESOLUTIONS.includes(divergence.resolution)
    ? divergence.resolution
    : 'unresolved';
  const errors = [];

  for (const item of resolutionEvidence) {
    if (!CLAIM_STATES.includes(item?.state)) errors.push(`invalid divergence evidence state: ${item?.state ?? 'missing'}`);
    if (item?.state === 'VERIFIED' && !item?.ref) errors.push('verified divergence evidence requires ref');
  }

  const boundaryBlocked = divergence.safetyBlocked === true || divergence.authorityViolation === true;
  const reconstructable = assumptions.length > 0 && Boolean(falsifier);
  const verifiedResolution = resolutionEvidence.some((item) => item?.state === 'VERIFIED' && item?.ref);

  let disposition = 'NEEDS_RECONSTRUCTION';
  let resolution = 'unresolved';

  if (boundaryBlocked) {
    disposition = 'REJECTED_BOUNDARY';
  } else if (!reconstructable) {
    disposition = 'NEEDS_RECONSTRUCTION';
  } else if (verifiedResolution && requestedResolution !== 'unresolved') {
    disposition = 'RESOLVED';
    resolution = requestedResolution;
  } else {
    disposition = 'TEST_ALTERNATIVE';
  }

  return {
    observed,
    reviewRequired: true,
    disposition,
    resolution,
    reconstructable,
    assumptions,
    falsifier,
    boundaryBlocked,
    verifiedResolution,
    errors,
  };
}

function normalizeCheckRuns(checkRuns) {
  return Array.isArray(checkRuns) ? checkRuns : [];
}

function successfulCheckNames(checkRuns, headSha) {
  return new Set(
    checkRuns
      .filter((item) => item?.headSha === headSha && item?.status === 'completed' && item?.conclusion === 'success')
      .map((item) => item?.name)
      .filter(Boolean),
  );
}

export function evaluateMergeReview(mergeReview = {}) {
  const requested = mergeReview?.requested === true;
  if (!requested) {
    return {
      requested: false,
      disposition: 'NOT_APPLICABLE',
      mergeAllowed: false,
      recommendedMergeMethod: null,
      selfAuthorize: false,
      bypassSuggested: false,
      missingRequiredChecks: [],
      codeScanningSatisfied: false,
      missingRequiredDeployments: [],
      requiredDeploymentsSatisfied: false,
      independentApprovalSatisfied: false,
      founderAuthoritySatisfied: false,
      headMatchesReview: false,
    };
  }

  const currentHeadSha = typeof mergeReview.currentHeadSha === 'string' ? mergeReview.currentHeadSha : '';
  const reviewedHeadSha = typeof mergeReview.reviewedHeadSha === 'string' ? mergeReview.reviewedHeadSha : '';
  const headMatchesReview = Boolean(currentHeadSha && reviewedHeadSha && currentHeadSha === reviewedHeadSha);
  const checkRuns = normalizeCheckRuns(mergeReview.checkRuns);
  const successfulChecks = successfulCheckNames(checkRuns, currentHeadSha);
  const requiredChecks = Array.isArray(mergeReview.requiredChecks)
    ? [...new Set(mergeReview.requiredChecks.filter((name) => typeof name === 'string' && name.trim()))]
    : [];
  const missingRequiredChecks = requiredChecks.filter((name) => !successfulChecks.has(name));

  const codeScanningRequired = mergeReview.rules?.codeScanningRequired === true;
  const codeScanningTool = typeof mergeReview.rules?.codeScanningTool === 'string'
    ? mergeReview.rules.codeScanningTool
    : 'CodeQL';
  const codeScanningSatisfied = !codeScanningRequired || successfulChecks.has(codeScanningTool);

  const requiredDeployments = Array.isArray(mergeReview.rules?.requiredDeployments)
    ? [...new Set(mergeReview.rules.requiredDeployments.filter((name) => typeof name === 'string' && name.trim()))]
    : [];
  const deploymentStatuses = Array.isArray(mergeReview.deploymentStatuses) ? mergeReview.deploymentStatuses : [];
  const successfulDeployments = new Set(
    deploymentStatuses
      .filter((item) => item?.headSha === currentHeadSha && item?.state === 'success')
      .map((item) => item?.environment)
      .filter(Boolean),
  );
  const missingRequiredDeployments = requiredDeployments.filter((name) => !successfulDeployments.has(name));
  const requiredDeploymentsSatisfied = missingRequiredDeployments.length === 0;

  const requireLastPushApproval = mergeReview.rules?.requireLastPushApproval === true;
  const lastPusher = typeof mergeReview.lastPusher === 'string' ? mergeReview.lastPusher.trim() : '';
  const reviewer = typeof mergeReview.independentApproval?.reviewer === 'string'
    ? mergeReview.independentApproval.reviewer.trim()
    : '';
  const independentApprovalSatisfied = !requireLastPushApproval || Boolean(
    mergeReview.independentApproval?.approved === true
      && reviewer
      && lastPusher
      && reviewer !== lastPusher,
  );

  const founderAuthoritySatisfied = mergeReview.founderAuthorityExplicit === true;
  const allowedMergeMethods = Array.isArray(mergeReview.rules?.allowedMergeMethods)
    ? mergeReview.rules.allowedMergeMethods.filter((method) => ['merge', 'squash', 'rebase'].includes(method))
    : ['merge', 'squash', 'rebase'];
  const requestedMethod = ['merge', 'squash', 'rebase'].includes(mergeReview.requestedMethod)
    ? mergeReview.requestedMethod
    : null;
  const requiredLinearHistory = mergeReview.rules?.requiredLinearHistory === true;

  let recommendedMergeMethod = null;
  if (requiredLinearHistory) {
    if (requestedMethod && requestedMethod !== 'merge' && allowedMergeMethods.includes(requestedMethod)) {
      recommendedMergeMethod = requestedMethod;
    } else if (allowedMergeMethods.includes('squash')) {
      recommendedMergeMethod = 'squash';
    } else if (allowedMergeMethods.includes('rebase')) {
      recommendedMergeMethod = 'rebase';
    }
  } else if (requestedMethod && allowedMergeMethods.includes(requestedMethod)) {
    recommendedMergeMethod = requestedMethod;
  } else {
    recommendedMergeMethod = allowedMergeMethods[0] ?? null;
  }

  let disposition = 'READY';
  if (!headMatchesReview) disposition = 'REOBSERVE';
  else if (missingRequiredChecks.length > 0) disposition = 'WAIT_REQUIRED_CHECKS';
  else if (!codeScanningSatisfied) disposition = 'WAIT_CODE_SCANNING';
  else if (!requiredDeploymentsSatisfied) disposition = 'WAIT_REQUIRED_DEPLOYMENTS';
  else if (!independentApprovalSatisfied) disposition = 'WAIT_INDEPENDENT_APPROVAL';
  else if (!founderAuthoritySatisfied) disposition = 'WAIT_FOUNDER_AUTHORITY';
  else if (!recommendedMergeMethod) disposition = 'HOLD_METHOD';

  return {
    requested: true,
    disposition,
    mergeAllowed: disposition === 'READY',
    recommendedMergeMethod,
    selfAuthorize: false,
    bypassSuggested: false,
    currentHeadSha,
    reviewedHeadSha,
    headMatchesReview,
    missingRequiredChecks,
    codeScanningRequired,
    codeScanningTool,
    codeScanningSatisfied,
    requiredDeployments,
    missingRequiredDeployments,
    requiredDeploymentsSatisfied,
    requireLastPushApproval,
    lastPusher,
    reviewer,
    independentApprovalSatisfied,
    founderAuthoritySatisfied,
    requiredLinearHistory,
    requestedMethod,
    allowedMergeMethods,
  };
}

export function evaluateEvidenceDecision(input = {}) {
  const evidence = normalizeEvidence(input.evidence);
  const errors = [];

  if (!input.subjectFingerprint || typeof input.subjectFingerprint !== 'string') {
    errors.push('subjectFingerprint is required');
  }

  for (const item of evidence) {
    if (!EVIDENCE_PLANES.includes(item?.plane)) errors.push(`invalid evidence plane: ${item?.plane ?? 'missing'}`);
    if (!CLAIM_STATES.includes(item?.state)) errors.push(`invalid claim state: ${item?.state ?? 'missing'}`);
  }

  const divergence = evaluateDivergence(input.divergence);
  errors.push(...divergence.errors);
  const mergeReview = evaluateMergeReview(input.mergeReview);

  const subjectChanged = Boolean(
    input.expectedFingerprint
      && input.subjectFingerprint
      && input.expectedFingerprint !== input.subjectFingerprint,
  );
  const staleEvidence = evidence.some((item) => item?.stale === true);
  const executionVerified = hasVerifiedPlane(evidence, 'execution');
  const outcomeVerified = hasVerifiedPlane(evidence, 'outcome');
  const primarySignal = input.signals?.primary ?? 'unknown';
  const secondarySignal = input.signals?.secondary ?? 'unknown';

  const winnerAllowed = Boolean(
    !subjectChanged
      && !staleEvidence
      && outcomeVerified
      && primarySignal === 'improved',
  );

  let claimState = 'UNKNOWN';
  if (subjectChanged || staleEvidence) {
    claimState = 'UNKNOWN';
  } else if (outcomeVerified) {
    claimState = 'VERIFIED';
  } else if (executionVerified) {
    claimState = 'OBSERVED';
  } else {
    claimState = bestNonVerifiedState(evidence);
  }

  let recommendation = 'HOLD';
  if (errors.length) {
    recommendation = 'HOLD';
  } else if (subjectChanged || staleEvidence) {
    recommendation = 'REOBSERVE';
  } else if (divergence.observed && divergence.disposition === 'TEST_ALTERNATIVE') {
    recommendation = 'INVESTIGATE_DIVERGENCE';
  } else if (mergeReview.requested && mergeReview.disposition === 'REOBSERVE') {
    recommendation = 'REOBSERVE';
  } else if (mergeReview.requested && mergeReview.disposition === 'READY') {
    recommendation = 'PROPOSE_MERGE';
  } else if (mergeReview.requested) {
    recommendation = 'HOLD';
  } else if (winnerAllowed) {
    recommendation = 'PROPOSE_KEEP';
  } else if (outcomeVerified && primarySignal === 'degraded') {
    recommendation = 'PROPOSE_TUNE';
  } else if (outcomeVerified && primarySignal === 'unchanged') {
    recommendation = 'REVIEW';
  } else if (executionVerified && !outcomeVerified) {
    recommendation = 'MEASURE';
  } else if (secondarySignal === 'improved' && !outcomeVerified) {
    recommendation = 'MEASURE';
  }

  return {
    contract: EVIDENCE_DECISION_LOOP_CONTRACT,
    valid: errors.length === 0,
    errors,
    subjectChanged,
    staleEvidence,
    executionVerified,
    outcomeVerified,
    claimState,
    winnerAllowed,
    recommendation,
    divergence,
    mergeReview,
    selfAuthorize: false,
    founderReviewRequired: Boolean(input.consequentialAction ?? true),
    invariants: {
      executionIsNotOutcome: true,
      secondarySignalCannotWinAlone: true,
      changedFingerprintInvalidatesPriorProof: true,
      differenceIsNotAutomaticallyError: true,
      alternativePathIsHypothesisUntilVerified: true,
      safetyAndAuthorityCannotBeReasonedAround: true,
      requiredChecksMustMaterializeOnReviewedHead: true,
      codeScanningIsSeparateMergeEvidence: true,
      requiredDeploymentsAreSeparateMergeEvidence: true,
      independentApprovalCannotBeSelfSatisfied: true,
      linearHistoryForbidsMergeCommitFallback: true,
    },
  };
}
