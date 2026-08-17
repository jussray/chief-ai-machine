import { createHash } from 'node:crypto';

const EXACT_COMMIT_SHA = /^[0-9a-f]{40}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const HTTPS_URL = /^https:\/\//i;
const OWNED_REPO = /^jussray\/[A-Za-z0-9._-]+$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const MAX_CONTENT_TTL_MS = 72 * 60 * 60 * 1000;
const ALLOWED_STORY_TYPES = new Set([
  'founder-progress',
  'product-learning',
  'technical-story',
  'business-learning',
]);
const SECRET_LIKE = /(gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~+\/-]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})/i;
const FORBIDDEN_INPUT_KEYS = [
  'raw_diff',
  'raw_provider_payload',
  'credentials',
  'secret',
  'private_prompt',
  'chain_of_thought',
  'internal_notes',
];
const REQUIRED_SAUCE_GUARDS = [
  'private_implementation_removed',
  'secret_material_removed',
  'raw_diff_removed',
  'private_metrics_removed',
  'unreleased_roadmap_removed',
  'customer_private_data_removed',
  'security_sensitive_details_removed',
  'public_claims_only',
];

function asTrimmedString(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function reject(errors) {
  const error = new Error(`FOUNDER_CONTENT_REJECTED: ${errors.join('; ')}`);
  error.code = 'FOUNDER_CONTENT_REJECTED';
  error.details = errors;
  throw error;
}

function contentHash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function normalizeEvidenceRefs(value, claimIndex) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 8) {
    reject([`public_claims[${claimIndex}].evidence_refs must contain 1-8 internal evidence references`]);
  }
  const refs = [...new Set(value.map((ref) => asTrimmedString(ref, 500)).filter(Boolean))].sort();
  if (refs.length === 0) reject([`public_claims[${claimIndex}].evidence_refs cannot be empty`]);
  return refs;
}

function normalizeClaims(claims) {
  if (!Array.isArray(claims) || claims.length === 0) {
    reject(['public_claims must contain at least one claim']);
  }
  if (claims.length > 8) reject(['public_claims may contain at most 8 claims']);

  const seen = new Set();
  const publicClaims = [];
  const claimEvidence = [];

  claims.forEach((claim, index) => {
    const claimId = asTrimmedString(claim?.claim_id, 80).toLowerCase();
    const text = asTrimmedString(claim?.text, 500);
    const truthState = asTrimmedString(claim?.truth_state, 40).toLowerCase();
    const errors = [];

    if (!IDENTIFIER.test(claimId)) errors.push(`public_claims[${index}].claim_id is invalid`);
    if (seen.has(claimId)) errors.push(`public_claims[${index}].claim_id is duplicated`);
    if (!text) errors.push(`public_claims[${index}].text is required`);
    if (truthState !== 'verified') {
      errors.push(`public_claims[${index}].truth_state must be verified; interpretations belong in draft_text, not product-progress claims`);
    }
    if (claim?.public_safe !== true) errors.push(`public_claims[${index}].public_safe must be true`);
    if (SECRET_LIKE.test(text)) errors.push(`public_claims[${index}] contains secret-like material`);
    if (errors.length > 0) reject(errors);

    const evidenceRefs = normalizeEvidenceRefs(claim.evidence_refs, index);
    seen.add(claimId);
    publicClaims.push(Object.freeze({ claim_id: claimId, text, truth_state: 'verified', public_safe: true }));
    claimEvidence.push(Object.freeze({ claim_id: claimId, evidence_refs: Object.freeze(evidenceRefs) }));
  });

  return { publicClaims: Object.freeze(publicClaims), claimEvidence: Object.freeze(claimEvidence) };
}

function validateCurrentYou(currentYou = {}) {
  const errors = [];
  const intentId = asTrimmedString(currentYou.intent_id, 200);
  const source = asTrimmedString(currentYou.source, 80);

  if (currentYou.authenticated !== true) errors.push('current_you.authenticated must be true');
  if (!intentId) errors.push('current_you.intent_id is required');
  if (source !== 'current_authenticated_founder') {
    errors.push('current_you.source must be current_authenticated_founder');
  }
  if (currentYou.supersedes_stale_content_intent !== true) {
    errors.push('current_you.supersedes_stale_content_intent must be true');
  }

  if (errors.length > 0) reject(errors);
  return { intent_id: intentId, source };
}

function validateInternalEvidence(input = {}) {
  const evidence = input.internal_evidence && typeof input.internal_evidence === 'object'
    ? input.internal_evidence
    : {};
  const evidenceRef = asTrimmedString(evidence.ref, 1000);
  const digest = asTrimmedString(evidence.digest, 64).toLowerCase();
  const errors = [];

  if (evidence.verified !== true) errors.push('internal_evidence.verified must be true');
  if (!evidenceRef) errors.push('internal_evidence.ref is required');
  if (!HASH.test(digest)) errors.push('internal_evidence.digest must be sha256');
  if (evidence.not_for_publication !== true) {
    errors.push('internal_evidence.not_for_publication must be true');
  }

  if (errors.length > 0) reject(errors);
  return Object.freeze({
    ref: evidenceRef,
    digest,
    verified: true,
    not_for_publication: true,
  });
}

function validateFreshness(input = {}) {
  const issuedAt = asTrimmedString(input.issued_at, 64);
  const expiresAt = asTrimmedString(input.expires_at, 64);
  const issuedMs = Date.parse(issuedAt);
  const expiresMs = Date.parse(expiresAt);
  const errors = [];

  if (!issuedAt || Number.isNaN(issuedMs)) errors.push('issued_at must be an RFC3339 timestamp');
  if (!expiresAt || Number.isNaN(expiresMs)) errors.push('expires_at must be an RFC3339 timestamp');
  if (errors.length === 0) {
    if (expiresMs <= issuedMs) errors.push('expires_at must be after issued_at');
    if (expiresMs - issuedMs > MAX_CONTENT_TTL_MS) {
      errors.push('founder content proposal lifetime may not exceed 72 hours');
    }
  }

  if (errors.length > 0) reject(errors);
  return Object.freeze({ issued_at: new Date(issuedMs).toISOString(), expires_at: new Date(expiresMs).toISOString() });
}

function validateSauceGuard(input = {}) {
  const guard = input.sauce_guard && typeof input.sauce_guard === 'object' ? input.sauce_guard : {};
  const errors = REQUIRED_SAUCE_GUARDS
    .filter((key) => guard[key] !== true)
    .map((key) => `sauce_guard.${key} must be true`);

  for (const key of FORBIDDEN_INPUT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) errors.push(`${key} is forbidden in founder content input`);
  }

  if (errors.length > 0) reject(errors);
  return Object.freeze(Object.fromEntries(REQUIRED_SAUCE_GUARDS.map((key) => [key, true])));
}

export function buildFounderContentProposal(input = {}) {
  const sourceRepo = asTrimmedString(input.source_repo, 240);
  const sourceCommitSha = asTrimmedString(input.source_commit_sha, 40).toLowerCase();
  const draftText = asTrimmedString(input.draft_text, 3000);
  const storyType = asTrimmedString(input.story_type, 80).toLowerCase();
  const platform = asTrimmedString(input.platform, 80).toLowerCase() || 'linkedin';
  const publicProofUrl = asTrimmedString(input.public_proof_url, 1000);
  const errors = [];

  if (!OWNED_REPO.test(sourceRepo)) errors.push('source_repo must be an owned jussray repository');
  if (!EXACT_COMMIT_SHA.test(sourceCommitSha)) errors.push('source_commit_sha must be an exact 40-character commit SHA');
  if (!draftText) errors.push('draft_text is required');
  if (SECRET_LIKE.test(draftText)) errors.push('draft_text contains secret-like material');
  if (!IDENTIFIER.test(platform)) errors.push('platform is invalid');
  if (!ALLOWED_STORY_TYPES.has(storyType)) errors.push('story_type is not supported');
  if (publicProofUrl && !HTTPS_URL.test(publicProofUrl)) errors.push('public_proof_url must be HTTPS when supplied');

  if (errors.length > 0) reject(errors);

  const currentYou = validateCurrentYou(input.current_you);
  const internalEvidence = validateInternalEvidence(input);
  const freshness = validateFreshness(input);
  const sauceGuard = validateSauceGuard(input);
  const { publicClaims, claimEvidence } = normalizeClaims(input.public_claims);

  const publicPayload = Object.freeze({
    platform,
    story_type: storyType,
    draft_text: draftText,
    public_claims: publicClaims,
    proof_link: publicProofUrl || null,
    proof_link_policy: 'editorial_optional',
  });

  const identity = {
    version: 1,
    source_repo: sourceRepo,
    source_commit_sha: sourceCommitSha,
    current_you_intent_id: currentYou.intent_id,
    freshness,
    internal_evidence: internalEvidence,
    claim_evidence: claimEvidence,
    public_payload: publicPayload,
    sauce_guard: sauceGuard,
  };

  return Object.freeze({
    version: 1,
    kind: 'chief-ai/founder-content-proposal',
    source: Object.freeze({
      repo: sourceRepo,
      commit_sha: sourceCommitSha,
    }),
    freshness,
    public_payload: publicPayload,
    internal_evidence: internalEvidence,
    claim_evidence: claimEvidence,
    sauce_guard: sauceGuard,
    authority: Object.freeze({
      proposal_only: true,
      publish_authorized: false,
      current_you_source: currentYou.source,
      current_you_intent_id: currentYou.intent_id,
      future_you_advisory_only: true,
      historical_content_intent_authoritative: false,
      analytics_feedback_authority: 'observation-only',
      analytics_can_authorize_publish: false,
      external_feedback_trusted_for_authority: false,
    }),
    proposal_hash: contentHash(identity),
  });
}
