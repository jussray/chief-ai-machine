import { createHash } from 'node:crypto';

const EXACT_COMMIT_SHA = /^[0-9a-f]{40}$/i;
const HTTPS_URL = /^https:\/\//i;
const OWNED_REPO = /^jussray\/[A-Za-z0-9._-]+$/;
const ALLOWED_TRUTH_STATES = new Set(['verified', 'inferred']);
const ALLOWED_STORY_TYPES = new Set([
  'founder-progress',
  'product-learning',
  'technical-story',
  'business-learning',
]);
const SECRET_LIKE = /(gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~+\/-]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;
const FORBIDDEN_INPUT_KEYS = [
  'raw_diff',
  'raw_provider_payload',
  'credentials',
  'secret',
  'private_prompt',
  'chain_of_thought',
  'internal_notes',
];

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
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

function normalizeClaims(claims) {
  if (!Array.isArray(claims) || claims.length === 0) {
    reject(['public_claims must contain at least one claim']);
  }
  if (claims.length > 8) reject(['public_claims may contain at most 8 claims']);

  return claims.map((claim, index) => {
    const text = asTrimmedString(claim?.text);
    const truthState = asTrimmedString(claim?.truth_state).toLowerCase();
    const errors = [];

    if (!text) errors.push(`public_claims[${index}].text is required`);
    if (text.length > 500) errors.push(`public_claims[${index}].text exceeds 500 characters`);
    if (!ALLOWED_TRUTH_STATES.has(truthState)) {
      errors.push(`public_claims[${index}].truth_state must be verified or inferred`);
    }
    if (claim?.public_safe !== true) errors.push(`public_claims[${index}].public_safe must be true`);
    if (SECRET_LIKE.test(text)) errors.push(`public_claims[${index}] contains secret-like material`);

    if (errors.length > 0) reject(errors);
    return Object.freeze({ text, truth_state: truthState, public_safe: true });
  });
}

function validateCurrentYou(currentYou = {}) {
  const errors = [];
  const intentId = asTrimmedString(currentYou.intent_id);
  const source = asTrimmedString(currentYou.source);

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
  const evidenceRef = asTrimmedString(evidence.ref);
  const errors = [];

  if (evidence.verified !== true) errors.push('internal_evidence.verified must be true');
  if (!evidenceRef) errors.push('internal_evidence.ref is required');
  if (evidence.public_safe_source !== true) {
    errors.push('internal_evidence.public_safe_source must be true');
  }

  if (errors.length > 0) reject(errors);
  return { ref: evidenceRef, verified: true, public_safe_source: true };
}

function validateSauceGuard(input = {}) {
  const guard = input.sauce_guard && typeof input.sauce_guard === 'object' ? input.sauce_guard : {};
  const required = [
    'private_implementation_removed',
    'secret_material_removed',
    'raw_diff_removed',
    'public_claims_only',
  ];
  const errors = required
    .filter((key) => guard[key] !== true)
    .map((key) => `sauce_guard.${key} must be true`);

  for (const key of FORBIDDEN_INPUT_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key)) errors.push(`${key} is forbidden in founder content input`);
  }

  if (errors.length > 0) reject(errors);
  return Object.fromEntries(required.map((key) => [key, true]));
}

export function buildFounderContentProposal(input = {}) {
  const sourceRepo = asTrimmedString(input.source_repo);
  const sourceCommitSha = asTrimmedString(input.source_commit_sha);
  const draftText = asTrimmedString(input.draft_text);
  const storyType = asTrimmedString(input.story_type).toLowerCase();
  const publicProofUrl = asTrimmedString(input.public_proof_url);
  const errors = [];

  if (!OWNED_REPO.test(sourceRepo)) errors.push('source_repo must be an owned jussray repository');
  if (!EXACT_COMMIT_SHA.test(sourceCommitSha)) errors.push('source_commit_sha must be an exact 40-character commit SHA');
  if (!draftText) errors.push('draft_text is required');
  if (draftText.length > 3000) errors.push('draft_text exceeds 3000 characters');
  if (SECRET_LIKE.test(draftText)) errors.push('draft_text contains secret-like material');
  if (!ALLOWED_STORY_TYPES.has(storyType)) errors.push('story_type is not supported');
  if (publicProofUrl && !HTTPS_URL.test(publicProofUrl)) errors.push('public_proof_url must be HTTPS when supplied');

  if (errors.length > 0) reject(errors);

  const currentYou = validateCurrentYou(input.current_you);
  const internalEvidence = validateInternalEvidence(input);
  const sauceGuard = validateSauceGuard(input);
  const publicClaims = normalizeClaims(input.public_claims);

  const publicPayload = {
    platform: asTrimmedString(input.platform).toLowerCase() || 'linkedin',
    story_type: storyType,
    draft_text: draftText,
    public_claims: publicClaims,
    proof_link: publicProofUrl || null,
    proof_link_policy: 'editorial_optional',
  };

  const identity = {
    version: 1,
    source_repo: sourceRepo,
    source_commit_sha: sourceCommitSha,
    current_you_intent_id: currentYou.intent_id,
    public_payload: publicPayload,
    sauce_guard: sauceGuard,
  };

  return {
    version: 1,
    kind: 'chief-ai/founder-content-proposal',
    source: {
      repo: sourceRepo,
      commit_sha: sourceCommitSha,
    },
    public_payload: publicPayload,
    internal_evidence: internalEvidence,
    sauce_guard: sauceGuard,
    authority: {
      proposal_only: true,
      publish_authorized: false,
      current_you_source: currentYou.source,
      current_you_intent_id: currentYou.intent_id,
      future_you_advisory_only: true,
      historical_content_intent_authoritative: false,
    },
    proposal_hash: contentHash(identity),
  };
}
