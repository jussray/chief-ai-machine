import { createHash, createHmac } from 'node:crypto';

export const EXECUTION_LEASE_CONTRACT_V1 = 'juss-proof/execution-lease@v1';
export const EFFECT_RECEIPT_CONTRACT_V1 = 'juss-proof/effector-receipt@v1';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const ACTION = /^[a-z][a-z0-9:_-]{0,63}$/;

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function canonicalTimestamp(value, errorCode) {
  const parsed = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error(errorCode);
  }
  return parsed.toISOString();
}

function normalizeUuid(value, errorCode) {
  const normalized = text(value).toLowerCase();
  if (!UUID_V4.test(normalized)) throw new Error(errorCode);
  return normalized;
}

function normalizeDigest(value, errorCode) {
  const normalized = text(value).toLowerCase();
  if (!SHA256.test(normalized)) throw new Error(errorCode);
  return normalized;
}

function normalizeAction(value) {
  const normalized = text(value).toLowerCase();
  if (!ACTION.test(normalized)) throw new Error('invalid_action');
  return normalized;
}

function normalizeSigningKey(value) {
  const key = Buffer.isBuffer(value) ? value : Buffer.from(typeof value === 'string' ? value : '');
  if (key.byteLength < 32) throw new Error('invalid_effector_signing_key');
  return key;
}

function normalizeAllowedActions(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 32) {
    throw new Error('invalid_allowed_actions');
  }
  const actions = value.map(normalizeAction);
  if (new Set(actions).size !== actions.length) throw new Error('invalid_allowed_actions');
  return [...actions].sort((left, right) => left.localeCompare(right));
}

function normalizeTemporalInvariants(value, allowedActions) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) throw new Error('invalid_temporal_invariants');
  const normalized = value.map((invariant) => {
    if (!invariant || typeof invariant !== 'object') throw new Error('invalid_temporal_invariants');
    const action = normalizeAction(invariant.action);
    const requiresPriorAction = normalizeAction(invariant.requiresPriorAction);
    if (action === requiresPriorAction) throw new Error('invalid_temporal_invariants');
    if (!allowedActions.includes(action) || !allowedActions.includes(requiresPriorAction)) {
      throw new Error('invalid_temporal_invariants');
    }
    return { action, requiresPriorAction };
  });
  const keys = normalized.map((item) => `${item.action}:${item.requiresPriorAction}`);
  if (new Set(keys).size !== keys.length) throw new Error('invalid_temporal_invariants');
  return normalized.sort((left, right) =>
    `${left.action}:${left.requiresPriorAction}`.localeCompare(`${right.action}:${right.requiresPriorAction}`),
  );
}

function normalizeRequest(request) {
  if (!request || typeof request !== 'object') throw new Error('invalid_execution_request');
  const subject = text(request.subject);
  if (!subject || subject.length > 256) throw new Error('invalid_subject');
  return {
    attemptId: normalizeUuid(request.attemptId, 'invalid_attempt_id'),
    subject,
    action: normalizeAction(request.action),
    inputDigest: normalizeDigest(request.inputDigest, 'invalid_input_digest'),
  };
}

function leaseErrors(lease) {
  const errors = [];
  if (!lease || typeof lease !== 'object') return ['invalid_lease'];
  if (lease.contract !== EXECUTION_LEASE_CONTRACT_V1) errors.push('invalid_lease_contract');
  try { normalizeUuid(lease.leaseId, 'invalid_lease_id'); } catch (error) { errors.push(error.message); }
  if (!text(lease.subject) || text(lease.subject).length > 256) errors.push('invalid_subject');
  let allowedActions = [];
  try { allowedActions = normalizeAllowedActions(lease.allowedActions); } catch (error) { errors.push(error.message); }
  try { normalizeTemporalInvariants(lease.temporalInvariants, allowedActions); } catch (error) { errors.push(error.message); }
  if (!Number.isInteger(lease.maxEffects) || lease.maxEffects < 1 || lease.maxEffects > 100) {
    errors.push('invalid_max_effects');
  }
  try { normalizeDigest(lease.effectorCredentialBinding, 'invalid_effector_credential_binding'); } catch (error) { errors.push(error.message); }
  let issuedAt = null;
  let expiresAt = null;
  try { issuedAt = canonicalTimestamp(lease.issuedAt, 'invalid_issued_at'); } catch (error) { errors.push(error.message); }
  try { expiresAt = canonicalTimestamp(lease.expiresAt, 'invalid_expires_at'); } catch (error) { errors.push(error.message); }
  if (issuedAt && expiresAt && Date.parse(expiresAt) <= Date.parse(issuedAt)) errors.push('invalid_lease_window');
  if (lease.authorityOwner !== 'effector') errors.push('invalid_authority_owner');
  if (lease.evidenceOwner !== 'effector') errors.push('invalid_evidence_owner');
  if (lease.continuityMayAuthorizeAction !== false) errors.push('continuity_cannot_authorize');
  if (lease.deniedActionMayCreateEffectReceipt !== false) errors.push('denied_action_cannot_create_effect_receipt');
  return [...new Set(errors)];
}

export function createExecutionLeaseV1(input) {
  if (!input || typeof input !== 'object') throw new Error('invalid_lease');
  const leaseId = normalizeUuid(input.leaseId ?? globalThis.crypto.randomUUID(), 'invalid_lease_id');
  const subject = text(input.subject);
  if (!subject || subject.length > 256) throw new Error('invalid_subject');
  const allowedActions = normalizeAllowedActions(input.allowedActions);
  const temporalInvariants = normalizeTemporalInvariants(input.temporalInvariants, allowedActions);
  if (!Number.isInteger(input.maxEffects) || input.maxEffects < 1 || input.maxEffects > 100) {
    throw new Error('invalid_max_effects');
  }
  const effectorCredentialBinding = normalizeDigest(
    input.effectorCredentialBinding,
    'invalid_effector_credential_binding',
  );
  const issuedAt = canonicalTimestamp(input.issuedAt, 'invalid_issued_at');
  const expiresAt = canonicalTimestamp(input.expiresAt, 'invalid_expires_at');
  if (Date.parse(expiresAt) <= Date.parse(issuedAt)) throw new Error('invalid_lease_window');

  return {
    contract: EXECUTION_LEASE_CONTRACT_V1,
    leaseId,
    subject,
    allowedActions,
    temporalInvariants,
    maxEffects: input.maxEffects,
    effectorCredentialBinding,
    issuedAt,
    expiresAt,
    authorityOwner: 'effector',
    evidenceOwner: 'effector',
    continuityMayAuthorizeAction: false,
    deniedActionMayCreateEffectReceipt: false,
  };
}

function receiptCore(receipt) {
  return {
    contract: receipt.contract,
    receiptId: receipt.receiptId,
    leaseId: receipt.leaseId,
    attemptId: receipt.attemptId,
    subject: receipt.subject,
    action: receipt.action,
    inputDigest: receipt.inputDigest,
    outcome: receipt.outcome,
    issuerRole: receipt.issuerRole,
    credentialBinding: receipt.credentialBinding,
    previousReceiptHash: receipt.previousReceiptHash,
    decisionDigest: receipt.decisionDigest,
    observedAt: receipt.observedAt,
  };
}

function signatureFor(receiptHash, signingKey) {
  return createHmac('sha256', normalizeSigningKey(signingKey)).update(receiptHash).digest('hex');
}

function decisionDigest(lease, request, priorReceiptHashes, now) {
  return sha256({
    contract: EXECUTION_LEASE_CONTRACT_V1,
    leaseId: lease.leaseId,
    attemptId: request.attemptId,
    subject: request.subject,
    action: request.action,
    inputDigest: request.inputDigest,
    priorReceiptHashes,
    evaluatedAt: now,
  });
}

export function verifyEffectorLedgerV1({ lease, receipts = [], signingKey }) {
  const errors = [...leaseErrors(lease)];
  let key = null;
  try { key = normalizeSigningKey(signingKey); } catch (error) { errors.push(error.message); }
  if (!Array.isArray(receipts) || receipts.length > 100) return [...new Set([...errors, 'invalid_receipt_ledger'])];

  const seenAttempts = new Set();
  const successfulActions = [];
  let previousReceiptHash = null;
  let previousObservedAt = null;
  let succeededEffects = 0;

  for (let index = 0; index < receipts.length; index += 1) {
    const receipt = receipts[index];
    const prefix = `receipt_${index}`;
    if (!receipt || typeof receipt !== 'object') {
      errors.push(`${prefix}_invalid`);
      continue;
    }
    if (receipt.contract !== EFFECT_RECEIPT_CONTRACT_V1) errors.push(`${prefix}_contract_invalid`);
    try { normalizeUuid(receipt.receiptId, 'invalid_receipt_id'); } catch { errors.push(`${prefix}_id_invalid`); }
    let attemptId = null;
    try { attemptId = normalizeUuid(receipt.attemptId, 'invalid_attempt_id'); } catch { errors.push(`${prefix}_attempt_id_invalid`); }
    if (attemptId && seenAttempts.has(attemptId)) errors.push(`${prefix}_duplicate_attempt`);
    if (attemptId) seenAttempts.add(attemptId);
    if (receipt.leaseId !== lease?.leaseId) errors.push(`${prefix}_lease_mismatch`);
    if (receipt.subject !== lease?.subject) errors.push(`${prefix}_subject_mismatch`);
    if (!lease?.allowedActions?.includes(receipt.action)) errors.push(`${prefix}_action_not_allowed`);
    try { normalizeDigest(receipt.inputDigest, 'invalid_input_digest'); } catch { errors.push(`${prefix}_input_digest_invalid`); }
    if (!['effect_succeeded', 'effect_failed'].includes(receipt.outcome)) errors.push(`${prefix}_outcome_invalid`);
    if (receipt.issuerRole !== 'effector') errors.push(`${prefix}_issuer_not_effector`);
    if (receipt.credentialBinding !== lease?.effectorCredentialBinding) errors.push(`${prefix}_credential_binding_mismatch`);
    if (receipt.previousReceiptHash !== previousReceiptHash) errors.push(`${prefix}_chain_broken`);
    try { normalizeDigest(receipt.decisionDigest, 'invalid_decision_digest'); } catch { errors.push(`${prefix}_decision_digest_invalid`); }

    let observedAt = null;
    try { observedAt = canonicalTimestamp(receipt.observedAt, 'invalid_observed_at'); } catch { errors.push(`${prefix}_observed_at_invalid`); }
    if (observedAt) {
      const observedMs = Date.parse(observedAt);
      if (Date.parse(lease?.issuedAt) > observedMs || observedMs >= Date.parse(lease?.expiresAt)) {
        errors.push(`${prefix}_outside_lease_window`);
      }
      if (previousObservedAt && observedMs < Date.parse(previousObservedAt)) errors.push(`${prefix}_time_reversed`);
      previousObservedAt = observedAt;
    }

    const expectedHash = sha256(receiptCore(receipt));
    if (receipt.receiptHash !== expectedHash) errors.push(`${prefix}_hash_invalid`);
    if (!SHA256.test(text(receipt.signature).toLowerCase())) errors.push(`${prefix}_signature_invalid`);
    else if (key && receipt.signature.toLowerCase() !== signatureFor(expectedHash, key)) {
      errors.push(`${prefix}_signature_invalid`);
    }

    const invariant = lease?.temporalInvariants?.filter((item) => item.action === receipt.action) ?? [];
    for (const rule of invariant) {
      if (!successfulActions.includes(rule.requiresPriorAction)) {
        errors.push(`${prefix}_temporal_invariant_failed`);
      }
    }

    if (receipt.outcome === 'effect_succeeded') {
      succeededEffects += 1;
      successfulActions.push(receipt.action);
    }
    previousReceiptHash = receipt.receiptHash;
  }

  if (Number.isInteger(lease?.maxEffects) && succeededEffects > lease.maxEffects) {
    errors.push('max_effects_exceeded');
  }
  return [...new Set(errors)];
}

export function evaluateExecutionAttemptV1({ lease, request, receipts = [], signingKey, now }) {
  const reasons = [...leaseErrors(lease)];
  let normalizedRequest = null;
  let evaluatedAt = null;
  try { normalizedRequest = normalizeRequest(request); } catch (error) { reasons.push(error.message); }
  try { evaluatedAt = canonicalTimestamp(now, 'invalid_evaluation_time'); } catch (error) { reasons.push(error.message); }
  reasons.push(...verifyEffectorLedgerV1({ lease, receipts, signingKey }));

  if (normalizedRequest && lease) {
    if (normalizedRequest.subject !== lease.subject) reasons.push('subject_mismatch');
    if (!lease.allowedActions?.includes(normalizedRequest.action)) reasons.push('action_not_allowed');
    if (receipts.some((receipt) => receipt?.attemptId === normalizedRequest.attemptId)) reasons.push('duplicate_attempt');
    const succeededEffects = receipts.filter((receipt) => receipt?.outcome === 'effect_succeeded').length;
    if (succeededEffects >= lease.maxEffects) reasons.push('max_effects_reached');
    const successfulActions = receipts
      .filter((receipt) => receipt?.outcome === 'effect_succeeded')
      .map((receipt) => receipt.action);
    for (const invariant of lease.temporalInvariants ?? []) {
      if (invariant.action === normalizedRequest.action && !successfulActions.includes(invariant.requiresPriorAction)) {
        reasons.push(`missing_prior_action:${invariant.requiresPriorAction}`);
      }
    }
  }

  if (evaluatedAt && lease) {
    const nowMs = Date.parse(evaluatedAt);
    if (nowMs < Date.parse(lease.issuedAt)) reasons.push('lease_not_started');
    if (nowMs >= Date.parse(lease.expiresAt)) reasons.push('lease_expired');
  }

  const uniqueReasons = [...new Set(reasons)].sort((left, right) => left.localeCompare(right));
  const priorReceiptHashes = receipts.map((receipt) => receipt?.receiptHash).filter(Boolean);
  return {
    allowed: uniqueReasons.length === 0,
    reasons: uniqueReasons,
    decisionDigest: normalizedRequest && evaluatedAt && lease
      ? decisionDigest(lease, normalizedRequest, priorReceiptHashes, evaluatedAt)
      : null,
    continuityMayAuthorizeAction: false,
    deniedActionMayCreateEffectReceipt: false,
  };
}

export function createEffectorReceiptV1({
  lease,
  request,
  receipts = [],
  signingKey,
  observedAt,
  outcome = 'effect_succeeded',
  receiptId = globalThis.crypto.randomUUID(),
}) {
  if (!['effect_succeeded', 'effect_failed'].includes(outcome)) throw new Error('invalid_effect_outcome');
  const normalizedReceiptId = normalizeUuid(receiptId, 'invalid_receipt_id');
  const normalizedRequest = normalizeRequest(request);
  const admission = evaluateExecutionAttemptV1({
    lease,
    request: normalizedRequest,
    receipts,
    signingKey,
    now: observedAt,
  });
  if (!admission.allowed) throw new Error(`execution_denied:${admission.reasons.join(',')}`);

  const core = {
    contract: EFFECT_RECEIPT_CONTRACT_V1,
    receiptId: normalizedReceiptId,
    leaseId: lease.leaseId,
    attemptId: normalizedRequest.attemptId,
    subject: normalizedRequest.subject,
    action: normalizedRequest.action,
    inputDigest: normalizedRequest.inputDigest,
    outcome,
    issuerRole: 'effector',
    credentialBinding: lease.effectorCredentialBinding,
    previousReceiptHash: receipts.length ? receipts.at(-1).receiptHash : null,
    decisionDigest: admission.decisionDigest,
    observedAt: canonicalTimestamp(observedAt, 'invalid_observed_at'),
  };
  const receiptHash = sha256(core);
  return {
    ...core,
    receiptHash,
    signature: signatureFor(receiptHash, signingKey),
  };
}
