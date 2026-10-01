export const CONTINUITY_PROOF_CONTRACT = 'juss/continuity-proof@v1';

export const CONTINUITY_BINDINGS = Object.freeze([
  'subjectFingerprint',
  'authorityFingerprint',
  'runtimeFingerprint',
  'evidenceFingerprint',
  'outcomeFingerprint',
  'approvalFingerprint',
]);

const ACTION_KINDS = new Set(['merge', 'use', 'implement', 'fix', 'rectify', 'rollback', 'observe']);
const VERIFIED_STATES = new Set(['VERIFIED']);
const FORBIDDEN_COOKIE_KEYS = new Set(['secret', 'token', 'credential', 'password', 'apiKey', 'clientSecret']);

function cleanString(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeRefs(values) {
  return Array.isArray(values)
    ? [...new Set(values.filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
    : [];
}

function collectForbiddenKeys(value, path = 'proofCookie', found = []) {
  if (!value || typeof value !== 'object') return found;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_COOKIE_KEYS.has(key)) found.push(`${path}.${key}`);
    if (nested && typeof nested === 'object') collectForbiddenKeys(nested, `${path}.${key}`, found);
  }
  return found;
}

function normalizeBindings(value = {}) {
  return Object.fromEntries(
    CONTINUITY_BINDINGS.map((key) => [key, cleanString(value?.[key])]),
  );
}

function compareCookieToCurrent(cookieBindings, currentBindings) {
  const reasons = [];
  for (const key of CONTINUITY_BINDINGS) {
    const bound = cookieBindings[key];
    const current = currentBindings[key];
    if (bound && current && bound !== current) reasons.push(`${key} changed`);
  }
  return reasons;
}

function verifiedEvidenceRefs(evidence) {
  return normalizeRefs(
    (Array.isArray(evidence) ? evidence : [])
      .filter((item) => VERIFIED_STATES.has(item?.state) && cleanString(item?.ref))
      .map((item) => item.ref),
  );
}

export function evaluateContinuityTransition(input = {}) {
  const errors = [];
  const subjectFingerprint = cleanString(input.subjectFingerprint);
  if (!subjectFingerprint) errors.push('subjectFingerprint is required');

  const currentBindings = normalizeBindings({
    ...input.currentBindings,
    subjectFingerprint,
  });
  const incomingCookie = input.proofCookie && typeof input.proofCookie === 'object'
    ? input.proofCookie
    : null;
  const cookieBindings = normalizeBindings(incomingCookie ?? {});
  const forbiddenCookieFields = incomingCookie ? collectForbiddenKeys(incomingCookie) : [];
  if (forbiddenCookieFields.length) {
    errors.push(`proofCookie must be non-secret; forbidden fields: ${forbiddenCookieFields.join(', ')}`);
  }

  const invalidationReasons = incomingCookie
    ? compareCookieToCurrent(cookieBindings, currentBindings)
    : [];
  const cookieStale = invalidationReasons.length > 0;

  const evidenceRefs = verifiedEvidenceRefs(input.evidence);
  const verifiedEvidence = evidenceRefs.length > 0;

  const actionKind = ACTION_KINDS.has(input.action?.kind) ? input.action.kind : null;
  if (input.action?.kind && !actionKind) errors.push(`unsupported action kind: ${input.action.kind}`);

  const approval = input.founderApproval && typeof input.founderApproval === 'object'
    ? input.founderApproval
    : {};
  const approvalSubjectFingerprint = cleanString(approval.subjectFingerprint);
  const approvedKinds = Array.isArray(approval.allowedActions)
    ? approval.allowedActions.filter((kind) => ACTION_KINDS.has(kind))
    : [];
  const approvalMatches = Boolean(
    approval.explicit === true
      && subjectFingerprint
      && approvalSubjectFingerprint === subjectFingerprint
      && actionKind
      && approvedKinds.includes(actionKind),
  );

  const mayAct = Boolean(
    errors.length === 0
      && actionKind
      && !cookieStale
      && verifiedEvidence
      && approvalMatches,
  );

  const actionExecuted = input.action?.executed === true;
  const outcomeVerified = input.action?.outcomeVerified === true;
  const receiptRef = cleanString(input.action?.receiptRef);
  const emitFreshCookie = Boolean(mayAct && actionExecuted && outcomeVerified && receiptRef);

  const nextProofCookie = emitFreshCookie ? {
    contract: CONTINUITY_PROOF_CONTRACT,
    state: 'VERIFIED',
    ...currentBindings,
    action: actionKind,
    receiptRefs: normalizeRefs([...(incomingCookie?.receiptRefs ?? []), ...evidenceRefs, receiptRef]),
    supersedes: cleanString(incomingCookie?.id),
  } : null;

  return {
    contract: CONTINUITY_PROOF_CONTRACT,
    valid: errors.length === 0,
    errors,
    incomingCookiePresent: Boolean(incomingCookie),
    cookieStale,
    invalidationReasons,
    currentBindings,
    verifiedEvidence,
    evidenceRefs,
    actionKind,
    approvalMatches,
    mayAct,
    actionExecuted,
    outcomeVerified,
    emitFreshCookie,
    nextProofCookie,
    selfAuthorize: false,
    cookieGrantsAuthority: false,
    invariants: {
      evidenceOutranksContinuity: true,
      incomingEvidenceMayInvalidateCookie: true,
      approvedExecutedOutcomeEmitsFreshCookie: true,
      proofCookieIsNonSecret: true,
      proofCookieNeverCreatesAuthority: true,
      founderApprovalMustMatchCurrentSubjectAndAction: true,
      staleCookieBlocksActionUntilReobserved: true,
    },
  };
}
