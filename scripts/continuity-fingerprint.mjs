import { createHash } from 'node:crypto';

export const OPERATOR_CONTINUITY_CONTRACT_V2 = 'juss-v10/operator-continuity@v2';
export const OPERATOR_CONTINUITY_SOURCES_V2 = [
  'chatgpt', 'work', 'codex', 'chief', 'base44', 'manus',
];

const FULL_SHA = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const PROVENANCE_AUTH_MECHANISMS = new Set(['authenticated-transport', 'trusted-signer']);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizedEvidenceRefs(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(text).filter(Boolean))].sort();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
}

export function operatorContinuityDimensionFingerprint(value) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function optionalSha(value) {
  return value === null ? null : text(value).toLowerCase();
}

function optionalFingerprint(value) {
  return value === null || value === undefined ? null : text(value).toLowerCase();
}

function normalizedInput(input) {
  return {
    source: input.source,
    projectSlug: text(input.projectSlug),
    repositoryFullName: text(input.repositoryFullName).toLowerCase(),
    targetBranch: text(input.targetBranch),
    targetSha: text(input.targetSha).toLowerCase(),
    prNumber: input.prNumber === null ? null : input.prNumber,
    baseSha: optionalSha(input.baseSha),
    headSha: optionalSha(input.headSha),
    scopeFingerprint: optionalFingerprint(input.scopeFingerprint),
    proofFingerprint: optionalFingerprint(input.proofFingerprint),
    reviewFingerprint: optionalFingerprint(input.reviewFingerprint),
    providerFingerprint: optionalFingerprint(input.providerFingerprint),
    runtimeFingerprint: optionalFingerprint(input.runtimeFingerprint),
    authorityFingerprint: optionalFingerprint(input.authorityFingerprint),
    evidenceRefs: normalizedEvidenceRefs(input.evidenceRefs),
    observedAt: text(input.observedAt),
    expiresAt: text(input.expiresAt),
    predecessorFingerprint: optionalFingerprint(input.predecessorFingerprint),
  };
}

export function operatorContinuityInputErrorsV2(input) {
  const value = normalizedInput(input);
  const errors = [];
  if (!OPERATOR_CONTINUITY_SOURCES_V2.includes(value.source)) errors.push('unsupported operator continuity source');
  if (!value.projectSlug) errors.push('projectSlug is required');
  if (!REPOSITORY.test(value.repositoryFullName)) errors.push('repositoryFullName must be owner/name');
  if (!value.targetBranch) errors.push('targetBranch is required');
  if (!FULL_SHA.test(value.targetSha)) errors.push('targetSha must be a full 40-character Git SHA');
  if (value.prNumber !== null && (!Number.isInteger(value.prNumber) || value.prNumber <= 0)) {
    errors.push('prNumber must be a positive integer or null');
  }
  for (const [field, sha] of [['baseSha', value.baseSha], ['headSha', value.headSha]]) {
    if (sha !== null && !FULL_SHA.test(sha)) errors.push(`${field} must be a full 40-character Git SHA or null`);
  }
  for (const [field, fingerprint] of [
    ['scopeFingerprint', value.scopeFingerprint],
    ['proofFingerprint', value.proofFingerprint],
    ['reviewFingerprint', value.reviewFingerprint],
    ['providerFingerprint', value.providerFingerprint],
    ['runtimeFingerprint', value.runtimeFingerprint],
    ['authorityFingerprint', value.authorityFingerprint],
    ['predecessorFingerprint', value.predecessorFingerprint],
  ]) {
    if (fingerprint !== null && !SHA256.test(fingerprint)) {
      errors.push(`${field} must be a 64-character SHA-256 hash or null`);
    }
  }
  if (!Array.isArray(input.evidenceRefs)) errors.push('evidenceRefs must be an array');
  if (value.evidenceRefs.length === 0) errors.push('at least one evidenceRef is required');
  if (value.evidenceRefs.length > 40) errors.push('evidenceRefs must contain at most 40 entries');
  if (value.evidenceRefs.some((entry) => entry.length > 256)) errors.push('evidenceRef entries must be at most 256 characters');
  const observedMs = Date.parse(value.observedAt);
  const expiresMs = Date.parse(value.expiresAt);
  if (!Number.isFinite(observedMs)) errors.push('observedAt must be an ISO-compatible timestamp');
  if (!Number.isFinite(expiresMs)) errors.push('expiresAt must be an ISO-compatible timestamp');
  if (Number.isFinite(observedMs) && Number.isFinite(expiresMs) && expiresMs <= observedMs) {
    errors.push('expiresAt must be later than observedAt');
  }
  return [...new Set(errors)];
}

/**
 * State identity only. Observer identity, evidence references and freshness metadata
 * remain receipt provenance, so the same reality hashes identically across operators.
 */
export function operatorContinuityFingerprintV2(input) {
  const value = normalizedInput(input);
  return createHash('sha256').update(JSON.stringify([
    OPERATOR_CONTINUITY_CONTRACT_V2,
    value.projectSlug,
    value.repositoryFullName,
    value.targetBranch,
    value.targetSha,
    value.prNumber,
    value.baseSha,
    value.headSha,
    value.scopeFingerprint,
    value.proofFingerprint,
    value.reviewFingerprint,
    value.providerFingerprint,
    value.runtimeFingerprint,
    value.authorityFingerprint,
  ])).digest('hex');
}

/**
 * Deterministic content binding for the complete receipt metadata. This digest detects
 * accidental or unaccompanied mutation, but is deliberately not treated as authenticity:
 * evaluating continuity additionally requires an out-of-band authenticated transport
 * or trusted-signer context bound to this exact digest.
 */
export function operatorContinuityProvenanceDigestV2(input) {
  const value = normalizedInput(input);
  return createHash('sha256').update(JSON.stringify([
    OPERATOR_CONTINUITY_CONTRACT_V2,
    value.source,
    value.projectSlug,
    value.repositoryFullName,
    value.targetBranch,
    value.targetSha,
    value.prNumber,
    value.baseSha,
    value.headSha,
    value.scopeFingerprint,
    value.proofFingerprint,
    value.reviewFingerprint,
    value.providerFingerprint,
    value.runtimeFingerprint,
    value.authorityFingerprint,
    value.evidenceRefs,
    value.observedAt,
    value.expiresAt,
    value.predecessorFingerprint,
    operatorContinuityFingerprintV2(value),
    false,
    false,
    false,
    false,
    true,
  ])).digest('hex');
}

function provenanceAuthenticationErrors(receipt, authentication) {
  if (!authentication || typeof authentication !== 'object' || Array.isArray(authentication)) {
    return ['operator continuity provenance is unauthenticated'];
  }
  const errors = [];
  const mechanism = text(authentication.mechanism);
  const source = text(authentication.source);
  const provenanceDigest = text(authentication.provenanceDigest).toLowerCase();
  if (!PROVENANCE_AUTH_MECHANISMS.has(mechanism)) {
    errors.push('operator continuity provenance authentication mechanism is unsupported');
  }
  if (source !== receipt.source) {
    errors.push('operator continuity provenance authentication source mismatch');
  }
  if (!SHA256.test(provenanceDigest) || provenanceDigest !== text(receipt.provenanceDigest).toLowerCase()) {
    errors.push('operator continuity provenance authentication digest mismatch');
  }
  return errors;
}

export function createOperatorContinuityReceiptV2(input) {
  const value = normalizedInput(input);
  const errors = operatorContinuityInputErrorsV2(input);
  if (errors.length) throw new Error(errors.join('; '));
  return {
    contract: OPERATOR_CONTINUITY_CONTRACT_V2,
    ...value,
    predecessorFingerprint: value.predecessorFingerprint ?? null,
    fingerprint: operatorContinuityFingerprintV2(value),
    provenanceDigest: operatorContinuityProvenanceDigestV2(value),
    browserCookie: false,
    authorizing: false,
    standingMergeAuthority: false,
    approvalCarryForward: false,
    founderDecisionRequired: true,
  };
}

export function validateOperatorContinuityReceiptV2(receipt, now = null) {
  const input = {
    source: receipt.source,
    projectSlug: receipt.projectSlug,
    repositoryFullName: receipt.repositoryFullName,
    targetBranch: receipt.targetBranch,
    targetSha: receipt.targetSha,
    prNumber: receipt.prNumber,
    baseSha: receipt.baseSha,
    headSha: receipt.headSha,
    scopeFingerprint: receipt.scopeFingerprint,
    proofFingerprint: receipt.proofFingerprint,
    reviewFingerprint: receipt.reviewFingerprint,
    providerFingerprint: receipt.providerFingerprint,
    runtimeFingerprint: receipt.runtimeFingerprint,
    authorityFingerprint: receipt.authorityFingerprint,
    evidenceRefs: receipt.evidenceRefs,
    observedAt: receipt.observedAt,
    expiresAt: receipt.expiresAt,
    predecessorFingerprint: receipt.predecessorFingerprint,
  };
  const errors = operatorContinuityInputErrorsV2(input);
  if (receipt.contract !== OPERATOR_CONTINUITY_CONTRACT_V2) errors.push('operator continuity v2 contract is unsupported');
  if (receipt.fingerprint !== operatorContinuityFingerprintV2(input)) errors.push('operator continuity v2 fingerprint does not match bound evidence');
  const provenanceDigest = text(receipt.provenanceDigest).toLowerCase();
  if (!SHA256.test(provenanceDigest)) {
    errors.push('operator continuity v2 provenance digest must be a 64-character SHA-256 hash');
  } else if (provenanceDigest !== operatorContinuityProvenanceDigestV2(input)) {
    errors.push('operator continuity v2 provenance digest does not match bound receipt metadata');
  }
  if (now !== null && now !== undefined) {
    const nowMs = Date.parse(text(now));
    const observedMs = Date.parse(input.observedAt);
    if (!Number.isFinite(nowMs)) errors.push('operator continuity validation time must be an ISO-compatible timestamp');
    else if (Number.isFinite(observedMs) && observedMs > nowMs) errors.push('operator continuity observedAt cannot be in the future');
  }
  if (receipt.browserCookie !== false) errors.push('operator continuity must never become a browser cookie');
  if (receipt.authorizing !== false) errors.push('operator continuity cannot authorize actions');
  if (receipt.standingMergeAuthority !== false) errors.push('operator continuity cannot carry standing merge authority');
  if (receipt.approvalCarryForward !== false) errors.push('operator continuity cannot carry approval forward');
  if (receipt.founderDecisionRequired !== true) errors.push('operator continuity requires a separate explicit founder decision');
  return [...new Set(errors)];
}

export function evaluateOperatorContinuityReceiptV2(receipt, current, now, provenanceAuthentication = null) {
  const reasons = [];
  const add = (reason) => { if (!reasons.includes(reason)) reasons.push(reason); };
  if (validateOperatorContinuityReceiptV2(receipt).length) add('receipt_invalid');
  if (operatorContinuityInputErrorsV2(current).length) add('current_input_invalid');
  if (provenanceAuthenticationErrors(receipt, provenanceAuthentication).length) add('provenance_unauthenticated');
  const nowMs = Date.parse(now);
  const observedMs = Date.parse(receipt.observedAt);
  const expiresMs = Date.parse(receipt.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(observedMs) || !Number.isFinite(expiresMs)) {
    add('observation_time_invalid');
  } else if (observedMs > nowMs) {
    add('observation_time_invalid');
  } else if (nowMs >= expiresMs) {
    add('receipt_expired');
  }

  if (!reasons.includes('receipt_invalid') && !reasons.includes('current_input_invalid')) {
    const prior = normalizedInput(receipt);
    const next = normalizedInput(current);
    const fields = [
      ['projectSlug', 'project_moved'],
      ['repositoryFullName', 'repository_moved'],
      ['targetBranch', 'target_branch_moved'],
      ['targetSha', 'target_sha_moved'],
      ['prNumber', 'pr_moved'],
      ['baseSha', 'base_sha_moved'],
      ['headSha', 'head_sha_moved'],
      ['scopeFingerprint', 'scope_moved'],
      ['proofFingerprint', 'proof_moved'],
      ['reviewFingerprint', 'review_moved'],
      ['providerFingerprint', 'provider_moved'],
      ['runtimeFingerprint', 'runtime_moved'],
      ['authorityFingerprint', 'authority_moved'],
      ['predecessorFingerprint', 'predecessor_moved'],
    ];
    for (const [field, reason] of fields) if (prior[field] !== next[field]) add(reason);
  }

  const invalid = reasons.includes('receipt_invalid')
    || reasons.includes('current_input_invalid')
    || reasons.includes('observation_time_invalid')
    || reasons.includes('provenance_unauthenticated');
  return {
    state: invalid ? 'invalid' : reasons.length ? 'stale' : 'current',
    reasons: [...reasons].sort((a, b) => a.localeCompare(b)),
    reacquireRequired: invalid || reasons.length > 0,
    continuityMayAuthorizeAction: false,
  };
}
