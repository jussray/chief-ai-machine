import { createHash } from 'node:crypto';
import { evaluateEvidenceDecision } from './evidence-decision-loop.js';

export const TRUST_TRANSITION_CONTRACT = 'juss/trust-transition@v1';
export const ATTACK_1000_PRESSURE_BUDGET = 1000;
export const ATTACK_1000_ATTACK_FAMILIES = Object.freeze([
  'subject-drift',
  'authority-widening',
  'stale-cookie-replay',
  'idempotency-collision',
  'provider-acceptance-confusion',
  'forged-outcome-witness',
  'recovery-gap',
  'duplicate-execution',
  'historical-truth-rewrite',
  'untrusted-control-token',
]);

const HASH = /^[0-9a-f]{64}$/i;
const CONSEQUENCES = new Set(['routine', 'consequential', 'irreversible']);
const RECOVERY_MODES = new Set(['rollback', 'correction', 'safe_continuation', 'none']);

function clean(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanList(values, maxItems = 50, maxLength = 200) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value, maxLength)).filter(Boolean))].sort().slice(0, maxItems);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeHash(value) {
  const normalized = clean(value, 64).toLowerCase();
  return HASH.test(normalized) ? normalized : '';
}

function normalizeTransitionInput(input = {}) {
  const intent = input.intent && typeof input.intent === 'object' ? input.intent : {};
  const proposedAction = input.proposedAction && typeof input.proposedAction === 'object'
    ? input.proposedAction
    : {};
  const authority = input.authority && typeof input.authority === 'object' ? input.authority : {};
  const recovery = input.recovery && typeof input.recovery === 'object' ? input.recovery : {};

  return {
    intent: {
      goal: clean(intent.goal, 2000),
    },
    proposedAction: {
      action: clean(proposedAction.action, 200),
      target: clean(proposedAction.target, 500),
      parametersHash: normalizeHash(proposedAction.parametersHash),
      idempotencyKey: clean(proposedAction.idempotencyKey, 500),
    },
    consequence: clean(input.consequence, 40).toLowerCase(),
    authority: {
      granted: authority.granted === true,
      grantId: clean(authority.grantId, 500),
      action: clean(authority.action, 200),
      target: clean(authority.target, 500),
      scope: cleanList(authority.scope, 50, 200),
      reusable: authority.reusable === true,
    },
    recovery: {
      mode: clean(recovery.mode, 80).toLowerCase(),
      checkpoint: clean(recovery.checkpoint, 500),
      acknowledged: recovery.acknowledged === true,
    },
    runtimeFingerprint: normalizeHash(input.runtimeFingerprint),
  };
}

export function fingerprintAuthority(authority = {}) {
  const normalized = normalizeTransitionInput({ authority }).authority;
  return sha256(JSON.stringify([
    TRUST_TRANSITION_CONTRACT,
    normalized.granted,
    normalized.grantId || null,
    normalized.action,
    normalized.target,
    normalized.scope,
    normalized.reusable,
  ]));
}

export function fingerprintTrustTransition(input = {}) {
  const normalized = normalizeTransitionInput(input);
  return sha256(JSON.stringify([
    TRUST_TRANSITION_CONTRACT,
    normalized.intent.goal,
    normalized.proposedAction.action,
    normalized.proposedAction.target,
    normalized.proposedAction.parametersHash || null,
    normalized.proposedAction.idempotencyKey,
    normalized.consequence,
    fingerprintAuthority(normalized.authority),
    normalized.recovery.mode,
    normalized.recovery.checkpoint || null,
    normalized.recovery.acknowledged,
  ]));
}

export function createContinuityCookie(input = {}) {
  const normalized = normalizeTransitionInput(input);
  const transitionFingerprint = fingerprintTrustTransition(normalized);
  const authorityFingerprint = fingerprintAuthority(normalized.authority);
  return sha256(JSON.stringify([
    TRUST_TRANSITION_CONTRACT,
    'continuity-cookie',
    transitionFingerprint,
    authorityFingerprint,
    normalized.runtimeFingerprint || null,
  ]));
}

function validateCore(normalized) {
  const errors = [];
  if (!normalized.intent.goal) errors.push('intent.goal is required');
  if (!normalized.proposedAction.action) errors.push('proposedAction.action is required');
  if (!normalized.proposedAction.target) errors.push('proposedAction.target is required');
  if (!CONSEQUENCES.has(normalized.consequence)) errors.push('consequence is invalid');
  if (normalized.authority.granted && !normalized.authority.grantId) {
    errors.push('granted authority requires authority.grantId');
  }
  if (!normalized.authority.action || !normalized.authority.target) errors.push('authority action and target are required');
  if (normalized.authority.action !== normalized.proposedAction.action) errors.push('authority action does not match proposed action');
  if (normalized.authority.target !== normalized.proposedAction.target) errors.push('authority target does not match proposed target');
  if (normalized.authority.scope.length === 0) errors.push('authority scope is required');
  if (!RECOVERY_MODES.has(normalized.recovery.mode)) errors.push('recovery.mode is invalid');

  if (normalized.consequence === 'consequential' || normalized.consequence === 'irreversible') {
    if (!normalized.proposedAction.idempotencyKey) errors.push('consequential actions require an idempotency key');
    if (!normalized.runtimeFingerprint) errors.push('consequential actions require a runtime fingerprint');
    if (normalized.authority.reusable) errors.push('consequential authority must not be reusable');
    if (normalized.recovery.mode === 'none' || !normalized.recovery.acknowledged) {
      errors.push('consequential actions require acknowledged recovery');
    }
  }

  if (normalized.consequence === 'irreversible' && normalized.recovery.mode === 'rollback') {
    errors.push('irreversible actions cannot claim rollback recovery');
  }

  return errors;
}

function normalizeEvidence(items, transitionFingerprint, continuityCookie) {
  const evidence = [];
  const rejectedEvidence = [];
  for (const item of Array.isArray(items) ? items : []) {
    const plane = item?.plane === 'outcome' ? 'outcome' : item?.plane === 'execution' ? 'execution' : '';
    const ref = clean(item?.ref, 2000);
    const state = clean(item?.state, 40).toUpperCase();
    const itemTransition = normalizeHash(item?.transitionFingerprint);
    const itemCookie = normalizeHash(item?.continuityCookie);
    const fingerprint = normalizeHash(item?.fingerprint);
    const independent = item?.independent === true;

    const identityMatches = itemTransition === transitionFingerprint && itemCookie === continuityCookie;
    const independentOutcome = plane !== 'outcome' || independent;
    const valid = Boolean(plane && ref && fingerprint && identityMatches && independentOutcome);

    if (!valid) {
      rejectedEvidence.push({
        plane: plane || 'invalid',
        reason: !identityMatches
          ? 'IDENTITY_OR_COOKIE_MISMATCH'
          : plane === 'outcome' && !independent
            ? 'OUTCOME_WITNESS_NOT_INDEPENDENT'
            : 'INVALID_EVIDENCE',
      });
      continue;
    }

    evidence.push({
      plane,
      state: ['VERIFIED', 'OBSERVED', 'INFERRED', 'UNKNOWN', 'BLOCKED'].includes(state) ? state : 'UNKNOWN',
      ref,
      stale: item?.stale === true,
    });
  }
  return { evidence, rejectedEvidence };
}

export function evaluateTrustTransition(input = {}) {
  const normalized = normalizeTransitionInput(input);
  const errors = validateCore(normalized);
  const transitionFingerprint = fingerprintTrustTransition(normalized);
  const authorityFingerprint = fingerprintAuthority(normalized.authority);
  const continuityCookie = createContinuityCookie(normalized);

  const expectedTransitionFingerprint = normalizeHash(input.expectedTransitionFingerprint);
  const expectedContinuityCookie = normalizeHash(input.expectedContinuityCookie);
  const subjectDrifted = Boolean(expectedTransitionFingerprint && expectedTransitionFingerprint !== transitionFingerprint);
  const cookieExpired = Boolean(expectedContinuityCookie && expectedContinuityCookie !== continuityCookie);

  const normalizedEvidence = normalizeEvidence(input.evidence, transitionFingerprint, continuityCookie);
  const evidenceDecision = evaluateEvidenceDecision({
    subjectFingerprint: transitionFingerprint,
    expectedFingerprint: expectedTransitionFingerprint || transitionFingerprint,
    evidence: normalizedEvidence.evidence,
    signals: input.signals,
    consequentialAction: normalized.consequence !== 'routine',
  });

  if (!normalized.authority.granted && (evidenceDecision.executionVerified || evidenceDecision.outcomeVerified)) {
    errors.push('execution or outcome evidence cannot verify before scoped authority is granted');
  }

  const historicalOutcomeVerified = input.historicalVerification?.outcomeVerified === true
    && Boolean(normalizeHash(input.historicalVerification?.evidenceFingerprint));

  let disposition = normalized.authority.granted ? 'authorized' : 'awaiting_authority';
  if (errors.length) disposition = 'blocked';
  else if (subjectDrifted || cookieExpired) disposition = 'unknown';
  else if (evidenceDecision.outcomeVerified) disposition = 'verified';
  else if (evidenceDecision.executionVerified) disposition = 'unknown';

  const currentTruthState = subjectDrifted || cookieExpired
    ? 'stale'
    : evidenceDecision.outcomeVerified
      ? 'fresh'
      : 'unknown';

  const executionAllowed = Boolean(
    errors.length === 0
      && normalized.authority.granted
      && !subjectDrifted
      && !cookieExpired
      && !evidenceDecision.executionVerified
      && !evidenceDecision.outcomeVerified,
  );

  return {
    contract: TRUST_TRANSITION_CONTRACT,
    valid: errors.length === 0,
    errors,
    transitionFingerprint,
    authorityFingerprint,
    continuityCookie,
    subjectDrifted,
    cookieExpired,
    authorityGranted: normalized.authority.granted,
    executionAllowed,
    disposition,
    currentTruthState,
    historicalDisposition: historicalOutcomeVerified ? 'verified' : 'unverified',
    executionVerified: evidenceDecision.executionVerified,
    outcomeVerified: evidenceDecision.outcomeVerified,
    rejectedEvidence: normalizedEvidence.rejectedEvidence,
    evidenceDecision,
    selfAuthorize: false,
    attack1000: {
      pressureBudget: ATTACK_1000_PRESSURE_BUDGET,
      families: ATTACK_1000_ATTACK_FAMILIES,
      literalExternalActionsClaimed: 0,
    },
    invariants: {
      providerAcceptanceIsNotOutcome: true,
      consequentialMutationRequiresIdempotency: true,
      consequentialAuthorityIsOneTime: true,
      recoveryKnownBeforeConsequence: true,
      staleCookieCannotRenewAuthority: true,
      outcomeRequiresIndependentWitness: true,
      historicalVerificationIsNotRewrittenByStaleness: true,
      workflowTokensCannotExpandAuthority: true,
      proposalCannotSelfGrantAuthority: true,
    },
  };
}
