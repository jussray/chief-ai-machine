export const EVIDENCE_DECISION_LOOP_CONTRACT = 'juss/evidence-decision-loop@v1';

export const EVIDENCE_PLANES = Object.freeze(['source', 'execution', 'outcome']);
export const CLAIM_STATES = Object.freeze(['VERIFIED', 'OBSERVED', 'INFERRED', 'UNKNOWN', 'BLOCKED']);

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
    selfAuthorize: false,
    founderReviewRequired: Boolean(input.consequentialAction ?? true),
    invariants: {
      executionIsNotOutcome: true,
      secondarySignalCannotWinAlone: true,
      changedFingerprintInvalidatesPriorProof: true,
    },
  };
}
