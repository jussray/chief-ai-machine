import { evaluateEvidenceDecision } from './evidence-decision-loop.js';

export const TASK_ACCURACY_CONTRACT = 'juss/task-accuracy@v1';
export const TASK_ACCURACY_STATES = Object.freeze(['Matched', 'Partial', 'Missed', 'Unverified']);
export const TASK_ACCURACY_VERDICTS = Object.freeze(['matched', 'missed']);

function normalizeCriteria(criteria) {
  return Array.isArray(criteria) ? criteria : [];
}

function normalizeEvidence(evidence) {
  return Array.isArray(evidence) ? evidence : [];
}

export function evaluateTaskAccuracy(taskAccuracy = {}, evidence = [], decision = {}) {
  const intent = typeof taskAccuracy.intent === 'string' ? taskAccuracy.intent.trim() : '';
  const criteria = normalizeCriteria(taskAccuracy.acceptanceCriteria);
  const errors = [];
  const ids = new Set();

  if (!intent) errors.push('task accuracy intent is required');
  if (criteria.length === 0) errors.push('at least one acceptance criterion is required');

  for (const criterion of criteria) {
    const id = typeof criterion?.id === 'string' ? criterion.id.trim() : '';
    const text = typeof criterion?.text === 'string' ? criterion.text.trim() : '';
    if (!id) errors.push('acceptance criterion id is required');
    if (!text) errors.push(`acceptance criterion text is required: ${id || 'missing-id'}`);
    if (id && ids.has(id)) errors.push(`duplicate acceptance criterion id: ${id}`);
    if (id) ids.add(id);
  }

  const verifiedOutcomeEvidence = normalizeEvidence(evidence).filter((item) => (
    item?.plane === 'outcome'
      && item?.state === 'VERIFIED'
      && typeof item?.ref === 'string'
      && item.ref.trim()
      && typeof item?.claimId === 'string'
      && item.claimId.trim()
      && TASK_ACCURACY_VERDICTS.includes(item?.verdict)
  ));

  const criterionResults = criteria.map((criterion) => {
    const id = typeof criterion?.id === 'string' ? criterion.id.trim() : '';
    const linked = verifiedOutcomeEvidence.filter((item) => item.claimId.trim() === id);
    const hasMatched = linked.some((item) => item.verdict === 'matched');
    const hasMissed = linked.some((item) => item.verdict === 'missed');
    let state = 'Unverified';

    if (hasMatched && hasMissed) {
      state = 'Unverified';
      errors.push(`conflicting verified outcome evidence for acceptance criterion: ${id}`);
    } else if (hasMatched) {
      state = 'Matched';
    } else if (hasMissed) {
      state = 'Missed';
    }

    return {
      id,
      text: typeof criterion?.text === 'string' ? criterion.text.trim() : '',
      state,
      evidenceRefs: linked.map((item) => item.ref),
    };
  });

  const proofInvalidated = decision?.subjectChanged === true || decision?.staleEvidence === true;
  const matchedCount = criterionResults.filter((item) => item.state === 'Matched').length;
  const missedCount = criterionResults.filter((item) => item.state === 'Missed').length;
  const unverifiedCount = criterionResults.filter((item) => item.state === 'Unverified').length;

  let accuracy = 'Unverified';
  if (!proofInvalidated && errors.length === 0) {
    if (criterionResults.length > 0 && matchedCount === criterionResults.length) {
      accuracy = 'Matched';
    } else if (matchedCount > 0 || (missedCount > 0 && unverifiedCount > 0)) {
      accuracy = 'Partial';
    } else if (missedCount > 0 && missedCount === criterionResults.length) {
      accuracy = 'Missed';
    }
  }

  const completionClaimAllowed = Boolean(
    accuracy === 'Matched'
      && decision?.claimState === 'VERIFIED'
      && decision?.outcomeVerified === true
      && !proofInvalidated,
  );
  const claimedComplete = taskAccuracy.claimedComplete === true;
  const falseGreen = claimedComplete && !completionClaimAllowed;

  return {
    contract: TASK_ACCURACY_CONTRACT,
    valid: errors.length === 0,
    errors,
    intent,
    acceptanceCriteria: criterionResults,
    matchedCount,
    missedCount,
    unverifiedCount,
    accuracy,
    proofInvalidated,
    completionClaimAllowed,
    claimedComplete,
    falseGreen,
    invariants: {
      executionProofIsNotTaskCompletion: true,
      completionRequiresVerifiedOutcomeEvidence: true,
      outcomeEvidenceMustBindAcceptanceClaim: true,
      staleOrMovedSubjectInvalidatesCompletionProof: true,
      conflictingVerifiedEvidenceCannotProduceGreen: true,
    },
  };
}

export function evaluateTrackedTaskDecision(input = {}) {
  const decision = evaluateEvidenceDecision(input);
  return {
    ...decision,
    taskAccuracy: evaluateTaskAccuracy(input.taskAccuracy, input.evidence, decision),
  };
}
