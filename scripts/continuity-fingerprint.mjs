import { createHash } from 'node:crypto';

export const CONTINUITY_FINGERPRINT_CONTRACT = 'juss-continuity/fingerprint@v1';
export const CONTINUITY_COOKIE_CONTRACT = 'juss-continuity/cookie@v1';

const FULL_SHA = /^[0-9a-f]{40}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

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

function hash(value) {
  return createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');
}

function requiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
}

function repository(value) {
  const normalized = requiredText(value, 'repository').toLowerCase();
  if (!normalized.includes('/')) throw new Error('repository must be owner/name');
  return normalized;
}

function sha(value, field, required = false) {
  if (value === null) {
    if (required) throw new Error(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string' || !FULL_SHA.test(value.trim())) {
    throw new Error(`${field} must be a full 40-hex SHA`);
  }
  return value.trim().toLowerCase();
}

function fingerprint(value, field) {
  if (value === null) return null;
  if (typeof value !== 'string' || !SHA256.test(value.trim())) {
    throw new Error(`${field} must be a 64-hex SHA-256`);
  }
  return value.trim().toLowerCase();
}

function timestamp(value, field) {
  const normalized = requiredText(value, field);
  if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} must be an ISO-compatible timestamp`);
  return normalized;
}

function normalizePrNumber(value) {
  if (value === null) return null;
  if (!Number.isInteger(value) || value <= 0) throw new Error('prNumber must be a positive integer or null');
  return value;
}

function normalizeObservation(input) {
  return {
    project: requiredText(input.project, 'project'),
    repository: repository(input.repository),
    targetBranch: requiredText(input.targetBranch, 'targetBranch'),
    targetSha: sha(input.targetSha, 'targetSha', true),
    prNumber: normalizePrNumber(input.prNumber),
    baseSha: sha(input.baseSha, 'baseSha'),
    headSha: sha(input.headSha, 'headSha'),
    scopeFingerprint: fingerprint(input.scopeFingerprint, 'scopeFingerprint'),
    proofFingerprint: fingerprint(input.proofFingerprint, 'proofFingerprint'),
    reviewFingerprint: fingerprint(input.reviewFingerprint, 'reviewFingerprint'),
    providerFingerprint: fingerprint(input.providerFingerprint, 'providerFingerprint'),
    runtimeFingerprint: fingerprint(input.runtimeFingerprint, 'runtimeFingerprint'),
    authorityFingerprint: fingerprint(input.authorityFingerprint, 'authorityFingerprint'),
    observedAt: timestamp(input.observedAt, 'observedAt'),
  };
}

export function createContinuityFingerprint(input) {
  const observation = normalizeObservation(input);
  return {
    contract: CONTINUITY_FINGERPRINT_CONTRACT,
    digest: hash({ contract: CONTINUITY_FINGERPRINT_CONTRACT, observation }),
    observation,
  };
}

function fingerprintIntegrityValid(value) {
  if (!value || value.contract !== CONTINUITY_FINGERPRINT_CONTRACT || !SHA256.test(value.digest ?? '')) return false;
  try {
    return createContinuityFingerprint(value.observation).digest === value.digest.toLowerCase();
  } catch {
    return false;
  }
}

function expectedCookieId(value) {
  return hash({
    contract: value.contract,
    fingerprintDigest: value.fingerprint.digest,
    mintedAt: value.mintedAt,
    expiresAt: value.expiresAt,
    issuer: value.issuer,
    issuerIdentityState: value.issuerIdentityState,
    authority: value.authority,
  });
}

export function mintContinuityCookie(input) {
  if (!fingerprintIntegrityValid(input.fingerprint)) throw new Error('fingerprint integrity is invalid');
  const mintedAt = timestamp(input.mintedAt, 'mintedAt');
  const expiresAt = timestamp(input.expiresAt, 'expiresAt');
  if (Date.parse(expiresAt) <= Date.parse(mintedAt)) throw new Error('expiresAt must be after mintedAt');
  const withoutId = {
    contract: CONTINUITY_COOKIE_CONTRACT,
    fingerprint: input.fingerprint,
    mintedAt,
    expiresAt,
    issuer: requiredText(input.issuer, 'issuer'),
    issuerIdentityState: input.issuerIdentityState,
    authority: false,
  };
  return { ...withoutId, cookieId: expectedCookieId(withoutId) };
}

export function evaluateContinuityCookie(cookie, current, now) {
  const reasons = [];
  const push = (reason) => { if (!reasons.includes(reason)) reasons.push(reason); };

  if (!cookie || cookie.contract !== CONTINUITY_COOKIE_CONTRACT) push('cookie_contract_invalid');
  if (!SHA256.test(cookie?.cookieId ?? '')) push('cookie_id_malformed');
  if (cookie?.authority !== false) push('cookie_authority_invalid');
  if (cookie?.issuerIdentityState !== 'verified') push('cookie_issuer_unverified');

  if (cookie?.fingerprint?.contract !== CONTINUITY_FINGERPRINT_CONTRACT) push('fingerprint_contract_invalid');
  if (!SHA256.test(cookie?.fingerprint?.digest ?? '')) push('fingerprint_digest_malformed');
  if (!fingerprintIntegrityValid(cookie?.fingerprint)) push('fingerprint_integrity_mismatch');
  if (!fingerprintIntegrityValid(current)) push('current_fingerprint_invalid');

  try {
    const { cookieId: _cookieId, ...withoutId } = cookie;
    if (expectedCookieId(withoutId) !== cookie.cookieId.toLowerCase()) push('cookie_integrity_mismatch');
  } catch {
    push('cookie_integrity_mismatch');
  }

  const nowMs = Date.parse(now);
  const mintedAtMs = Date.parse(cookie?.mintedAt ?? '');
  const expiresAtMs = Date.parse(cookie?.expiresAt ?? '');
  if (
    Number.isNaN(nowMs)
    || Number.isNaN(mintedAtMs)
    || Number.isNaN(expiresAtMs)
    || expiresAtMs <= mintedAtMs
    || mintedAtMs > nowMs
  ) {
    push('cookie_time_invalid');
  } else if (nowMs > expiresAtMs) {
    push('cookie_expired');
  }

  if (fingerprintIntegrityValid(cookie?.fingerprint) && fingerprintIntegrityValid(current)) {
    const prior = cookie.fingerprint.observation;
    const next = current.observation;
    const fields = [
      ['project', 'project_moved'],
      ['repository', 'repository_moved'],
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
    ];
    for (const [field, reason] of fields) {
      if (prior[field] !== next[field]) push(reason);
    }
  }

  const invalidReasons = new Set([
    'cookie_contract_invalid',
    'cookie_id_malformed',
    'cookie_integrity_mismatch',
    'cookie_authority_invalid',
    'cookie_issuer_unverified',
    'cookie_time_invalid',
    'fingerprint_contract_invalid',
    'fingerprint_digest_malformed',
    'fingerprint_integrity_mismatch',
    'current_fingerprint_invalid',
  ]);
  const state = reasons.some((reason) => invalidReasons.has(reason))
    ? 'invalid'
    : reasons.length > 0
      ? 'stale'
      : 'current';

  return {
    state,
    currentFingerprintDigest: fingerprintIntegrityValid(current) ? current.digest.toLowerCase() : null,
    cookieFingerprintDigest: fingerprintIntegrityValid(cookie?.fingerprint)
      ? cookie.fingerprint.digest.toLowerCase()
      : null,
    reasons: [...reasons].sort((a, b) => a.localeCompare(b)),
    reacquireRequired: state !== 'current',
    continuityMayAuthorizeAction: false,
  };
}
