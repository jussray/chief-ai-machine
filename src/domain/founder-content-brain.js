const EXACT_COMMIT_SHA = /^[0-9a-f]{40}$/i;
const HASH = /^[0-9a-f]{64}$/i;
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const HTTPS_URL = /^https:\/\//i;
const OWNED_REPO = /^jussray\/[A-Za-z0-9._-]+$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const ALLOWED_TRUTH_STATES = new Set(['verified']);
const ALLOWED_TEMPORAL_CLASSES = new Set([
  'historical_version',
  'current_repo_state',
  'current_runtime',
  'metric',
]);
const ALLOWED_STORY_TYPES = new Set([
  'founder-progress',
  'product-learning',
  'technical-story',
  'business-learning',
]);
const ALLOWED_WITHHELD_CATEGORIES = new Set([
  'private-implementation',
  'private-prompt',
  'credentials',
  'raw-diff',
  'provider-payload',
  'internal-notes',
  'customer-data',
]);
const FORBIDDEN_INPUT_KEYS = new Set([
  'raw_diff',
  'raw_provider_payload',
  'credentials',
  'secret',
  'private_prompt',
  'chain_of_thought',
  'internal_notes',
  'customer_data',
]);
const SECRET_LIKE = /(gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~+/-]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|(?:api|access|auth)[_-]?token\s*[:=]\s*\S+)/i;
const EMAIL_LIKE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PRIVATE_URL = /https?:\/\/(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|[^/\s]+\.internal)(?:[/:?#]|$)/i;
const PRIVATE_ARTIFACT = /github\.com\/[^/\s]+\/[^/\s]+\/actions\/runs\/\d+(?:\/artifacts\/\d+)?/i;
const SAUCE_DETAIL = /\b(?:system prompt|private prompt|chain[- ]of[- ]thought|routing weights?|scoring formula|secret algorithm|internal notes?|raw diff|service[_ -]?role|environment variable|provider payload|database password)\b/i;
const HIGH_RISK_CLAIM = /\b(?:production[- ]ready|fully secure|security[- ]certified|compliance[- ]certified|certified compliant|live in production|production is live|customer traction|revenue traction)\b/i;
const CURRENT_LANGUAGE = /\b(currently|right now|is live|are live|is green|are green|remains|still (?:is|are|has|have)|now (?:is|are|has|have))\b/i;
const HISTORICAL_LANGUAGE = /\b(built|shipped|implemented|added|merged|completed|released|tested|verified|fixed|created|introduced|deployed|reached|grew|was|were|did)\b/i;
const CURRENT_RUNTIME_LANGUAGE = /(?:\b(?:production|runtime|site|app|api|service|endpoint|deployment)\b.{0,80}\b(?:live|healthy|up|reachable|serving|available)\b)|(?:\b(?:live|healthy|up|reachable|serving|available)\b.{0,80}\b(?:production|runtime|site|app|api|service|endpoint|deployment)\b)/i;
const METRIC_LANGUAGE = /(?:\b(?:have|has|currently|now)\b.{0,40}\b\d[\d,.]*\s*(?:followers?|impressions?|users?|downloads?|signups?|customers?|sales)\b)|(?:\b(?:revenue|mrr|arr|gmv|conversion|engagement rate)\b.{0,30}(?:\$\s?\d|\d[\d,.]*|\d+(?:\.\d+)?%))|(?:\d+(?:\.\d+)?%)/i;
const MAX_INTENT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CONTENT_TTL_MS = 72 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const SHA256_K = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function reject(errors) {
  throw Object.assign(new Error(`FOUNDER_CONTENT_REJECTED: ${errors.join('; ')}`), {
    code: 'FOUNDER_CONTENT_REJECTED',
    details: errors,
  });
}

function rotateRight(value, count) {
  return (value >>> count) | (value << (32 - count));
}

function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text);
  const bitLength = bytes.length * 8;
  const paddedLength = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLength);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Math.floor(bitLength / 0x100000000), false);
  view.setUint32(paddedLength - 4, bitLength >>> 0, false);

  const state = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const words = new Uint32Array(64);

  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index += 1) {
      const w15 = words[index - 15];
      const w2 = words[index - 2];
      const s0 = rotateRight(w15, 7) ^ rotateRight(w15, 18) ^ (w15 >>> 3);
      const s1 = rotateRight(w2, 17) ^ rotateRight(w2, 19) ^ (w2 >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let a = state[0];
    let b = state[1];
    let c = state[2];
    let d = state[3];
    let e = state[4];
    let f = state[5];
    let g = state[6];
    let h = state[7];

    for (let index = 0; index < 64; index += 1) {
      const sum1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choose = (e & f) ^ (~e & g);
      const temp1 = (h + sum1 + choose + SHA256_K[index] + words[index]) >>> 0;
      const sum0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sum0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    state[0] = (state[0] + a) >>> 0;
    state[1] = (state[1] + b) >>> 0;
    state[2] = (state[2] + c) >>> 0;
    state[3] = (state[3] + d) >>> 0;
    state[4] = (state[4] + e) >>> 0;
    state[5] = (state[5] + f) >>> 0;
    state[6] = (state[6] + g) >>> 0;
    state[7] = (state[7] + h) >>> 0;
  }

  return [...state].map((word) => word.toString(16).padStart(8, '0')).join('');
}

function contentHash(value) {
  return sha256Hex(JSON.stringify(value));
}

function scanPublicText(text, field) {
  const findings = [];
  if (SECRET_LIKE.test(text)) findings.push(`${field} contains secret-like material`);
  if (EMAIL_LIKE.test(text)) findings.push(`${field} contains an email address`);
  if (PRIVATE_URL.test(text)) findings.push(`${field} contains a private-network URL`);
  if (PRIVATE_ARTIFACT.test(text)) findings.push(`${field} contains a private workflow artifact URL`);
  if (SAUCE_DETAIL.test(text)) findings.push(`${field} contains proprietary implementation detail`);
  if (text.includes('```')) findings.push(`${field} contains a code block; public code disclosure requires a separate review`);
  if (HIGH_RISK_CLAIM.test(text)) findings.push(`${field} contains a high-risk public claim requiring a dedicated proof contract`);
  return findings;
}

function findForbiddenKeys(value, path = 'input', findings = []) {
  if (!value || typeof value !== 'object') return findings;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_INPUT_KEYS.has(key)) findings.push(`${childPath} is forbidden in founder content input`);
    if (child && typeof child === 'object') findForbiddenKeys(child, childPath, findings);
  }
  return findings;
}

function normalizeStringList(value, field, { required = false, max = 12 } = {}) {
  const items = Array.isArray(value)
    ? value.map(asTrimmedString).filter(Boolean)
    : [];
  if (required && items.length === 0) reject([`${field} must contain at least one value`]);
  if (items.length > max) reject([`${field} may contain at most ${max} values`]);
  return [...new Set(items)];
}

function validateCurrentYou(currentYou = {}, evaluatedAt) {
  const errors = [];
  const intentId = asTrimmedString(currentYou.intent_id);
  const source = asTrimmedString(currentYou.source);
  const observedAt = asTrimmedString(currentYou.observed_at);
  const intentVersion = currentYou.intent_version;

  if (currentYou.authenticated !== true) errors.push('current_you.authenticated must be true');
  if (!intentId) errors.push('current_you.intent_id is required');
  if (!Number.isInteger(intentVersion) || intentVersion < 1) errors.push('current_you.intent_version must be a positive integer');
  if (source !== 'current_authenticated_founder') {
    errors.push('current_you.source must be current_authenticated_founder');
  }
  if (!ISO_DATE.test(observedAt)) errors.push('current_you.observed_at must be ISO UTC');
  if (!ISO_DATE.test(evaluatedAt)) errors.push('evaluated_at must be ISO UTC');

  if (ISO_DATE.test(observedAt) && ISO_DATE.test(evaluatedAt)) {
    const observed = Date.parse(observedAt);
    const evaluated = Date.parse(evaluatedAt);
    if (observed > evaluated + MAX_CLOCK_SKEW_MS) errors.push('current_you.observed_at is implausibly future-dated');
    if (evaluated - observed > MAX_INTENT_AGE_MS) errors.push('current_you intent is stale and must be reconfirmed');
  }

  if (errors.length > 0) reject(errors);
  return {
    intent_id: intentId,
    intent_version: intentVersion,
    source,
    observed_at: observedAt,
    evaluated_at: evaluatedAt,
  };
}

function validateFreshness(input = {}, evaluatedAt) {
  const issuedAt = asTrimmedString(input.issued_at);
  const expiresAt = asTrimmedString(input.expires_at);
  const errors = [];

  if (!ISO_DATE.test(issuedAt)) errors.push('issued_at must be ISO UTC');
  if (!ISO_DATE.test(expiresAt)) errors.push('expires_at must be ISO UTC');
  if (ISO_DATE.test(issuedAt) && ISO_DATE.test(expiresAt)) {
    const issued = Date.parse(issuedAt);
    const expires = Date.parse(expiresAt);
    const evaluated = ISO_DATE.test(evaluatedAt) ? Date.parse(evaluatedAt) : issued;
    if (expires <= issued) errors.push('expires_at must be after issued_at');
    if (expires - issued > MAX_CONTENT_TTL_MS) errors.push('founder content proposal lifetime may not exceed 72 hours');
    if (issued > evaluated + MAX_CLOCK_SKEW_MS) errors.push('issued_at is implausibly future-dated');
    if (expires <= evaluated) errors.push('founder content proposal is already expired');
  }

  if (errors.length > 0) reject(errors);
  return { issued_at: issuedAt, expires_at: expiresAt };
}

function validateInternalEvidence(input = {}, sourceRepo, sourceCommitSha) {
  const evidence = input.internal_evidence && typeof input.internal_evidence === 'object'
    ? input.internal_evidence
    : {};
  const evidenceRef = asTrimmedString(evidence.ref);
  const evidenceKind = asTrimmedString(evidence.kind);
  const digest = asTrimmedString(evidence.digest).toLowerCase();
  const evidenceRepo = asTrimmedString(evidence.source_repo);
  const evidenceSha = asTrimmedString(evidence.source_commit_sha);
  const proves = normalizeStringList(evidence.proves, 'internal_evidence.proves', { required: true });
  const doesNotProve = normalizeStringList(evidence.does_not_prove, 'internal_evidence.does_not_prove');
  const errors = [];

  if (evidence.verified !== true) errors.push('internal_evidence.verified must be true');
  if (!evidenceRef) errors.push('internal_evidence.ref is required');
  if (!evidenceKind) errors.push('internal_evidence.kind is required');
  if (!HASH.test(digest)) errors.push('internal_evidence.digest must be sha256');
  if (evidence.not_for_publication !== true) errors.push('internal_evidence.not_for_publication must be true');
  if (evidenceRepo !== sourceRepo) errors.push('internal_evidence.source_repo must match source_repo');
  if (evidenceSha !== sourceCommitSha) errors.push('internal_evidence.source_commit_sha must match source_commit_sha');

  if (errors.length > 0) reject(errors);
  return {
    verified: true,
    ref: evidenceRef,
    kind: evidenceKind,
    digest,
    not_for_publication: true,
    source_repo: evidenceRepo,
    source_commit_sha: evidenceSha,
    proves,
    does_not_prove: doesNotProve,
  };
}

function normalizeClaims(claims, internalEvidence, sourceCommitSha) {
  if (!Array.isArray(claims) || claims.length === 0) {
    reject(['public_claims must contain at least one claim']);
  }
  if (claims.length > 8) reject(['public_claims may contain at most 8 claims']);

  return claims.map((claim, index) => {
    const claimId = asTrimmedString(claim?.claim_id).toLowerCase();
    const text = asTrimmedString(claim?.text);
    const truthState = asTrimmedString(claim?.truth_state).toLowerCase();
    const evidenceRef = asTrimmedString(claim?.evidence_ref);
    const evidenceScope = asTrimmedString(claim?.evidence_scope);
    const temporalClass = asTrimmedString(claim?.temporal_class).toLowerCase();
    const temporalVersionRaw = asTrimmedString(claim?.temporal_version).toLowerCase();
    const temporalVersion = temporalVersionRaw || null;
    const historical = HISTORICAL_LANGUAGE.test(text) && !CURRENT_LANGUAGE.test(text);
    const errors = [];

    if (!IDENTIFIER.test(claimId)) errors.push(`public_claims[${index}].claim_id is invalid`);
    if (!text) errors.push(`public_claims[${index}].text is required`);
    if (text.length > 500) errors.push(`public_claims[${index}].text exceeds 500 characters`);
    if (!ALLOWED_TRUTH_STATES.has(truthState)) {
      errors.push(`public_claims[${index}].truth_state must be verified; interpretations belong in draft_text`);
    }
    if (claim?.public_safe !== true) errors.push(`public_claims[${index}].public_safe must be true`);
    if (evidenceRef !== internalEvidence.ref) errors.push(`public_claims[${index}].evidence_ref must match internal evidence`);
    if (!evidenceScope || !internalEvidence.proves.includes(evidenceScope)) {
      errors.push(`public_claims[${index}].evidence_scope must be explicitly covered by internal evidence`);
    }
    if (!ALLOWED_TEMPORAL_CLASSES.has(temporalClass)) {
      errors.push(`public_claims[${index}].temporal_class must be historical_version, current_repo_state, current_runtime, or metric`);
    }
    if ((temporalClass === 'historical_version' || temporalClass === 'current_repo_state') && temporalVersion !== sourceCommitSha.toLowerCase()) {
      errors.push(`public_claims[${index}].temporal_version must match the exact source_commit_sha for ${temporalClass}`);
    }
    if ((temporalClass === 'current_runtime' || temporalClass === 'metric') && temporalVersion !== null) {
      errors.push(`public_claims[${index}].temporal_version must be empty for ${temporalClass}`);
    }
    if (temporalClass === 'historical_version') {
      if (CURRENT_LANGUAGE.test(text)) errors.push(`public_claims[${index}] historical_version uses current-state language`);
      if (!HISTORICAL_LANGUAGE.test(text)) errors.push(`public_claims[${index}] historical_version requires explicit historical framing`);
    }
    if (temporalClass === 'current_repo_state' && CURRENT_RUNTIME_LANGUAGE.test(text)) {
      errors.push(`public_claims[${index}] current_repo_state uses runtime-state language and requires current_runtime evidence`);
    }
    if (temporalClass !== 'metric' && METRIC_LANGUAGE.test(text) && !historical) {
      errors.push(`public_claims[${index}] current metric language requires metric evidence`);
    }
    errors.push(...scanPublicText(text, `public_claims[${index}]`));

    if (errors.length > 0) reject(errors);
    return Object.freeze({
      claim_id: claimId,
      text,
      truth_state: truthState,
      public_safe: true,
      evidence_ref: evidenceRef,
      evidence_scope: evidenceScope,
      temporal_class: temporalClass,
      temporal_version: temporalVersion,
    });
  });
}

function validateSauceGuard(input = {}, publicText) {
  const guard = input.sauce_guard && typeof input.sauce_guard === 'object' ? input.sauce_guard : {};
  const attestations = [
    'private_implementation_removed',
    'secret_material_removed',
    'raw_diff_removed',
    'private_metrics_removed',
    'unreleased_roadmap_removed',
    'customer_private_data_removed',
    'security_sensitive_details_removed',
    'public_claims_only',
  ];
  const errors = attestations
    .filter((key) => guard[key] !== true)
    .map((key) => `sauce_guard.${key} must be true`);

  errors.push(...findForbiddenKeys(input));
  errors.push(...scanPublicText(publicText, 'draft_text'));

  const withheldCategories = normalizeStringList(
    guard.withheld_categories,
    'sauce_guard.withheld_categories',
    { max: 7 },
  );
  for (const category of withheldCategories) {
    if (!ALLOWED_WITHHELD_CATEGORIES.has(category)) {
      errors.push(`sauce_guard.withheld_categories contains unsupported category ${category}`);
    }
  }

  if (errors.length > 0) reject(errors);
  return {
    scanner_version: 'sauce-guard-v1',
    private_implementation_removed: true,
    secret_material_removed: true,
    raw_diff_removed: true,
    private_metrics_removed: true,
    unreleased_roadmap_removed: true,
    customer_private_data_removed: true,
    security_sensitive_details_removed: true,
    public_claims_only: true,
    independent_scan_passed: true,
    blocked_categories: [],
    withheld_categories: withheldCategories,
  };
}

export function founderContentProposalIdentity({
  source,
  currentYou,
  freshness,
  publicPayload,
  internalEvidence,
  sauceGuard,
}) {
  return {
    version: 1,
    source: {
      repo: source.repo,
      commit_sha: source.commit_sha,
    },
    current_you: {
      intent_id: currentYou.intent_id,
      intent_version: currentYou.intent_version,
      observed_at: currentYou.observed_at,
      evaluated_at: currentYou.evaluated_at,
    },
    freshness,
    public_payload: publicPayload,
    internal_evidence: internalEvidence,
    sauce_guard: sauceGuard,
  };
}

export function computeFounderContentProposalHash(identity) {
  return contentHash(identity);
}

export function buildFounderContentProposal(input = {}) {
  const sourceRepo = asTrimmedString(input.source_repo);
  const sourceCommitSha = asTrimmedString(input.source_commit_sha);
  const draftText = asTrimmedString(input.draft_text);
  const storyType = asTrimmedString(input.story_type).toLowerCase();
  const publicProofUrl = asTrimmedString(input.public_proof_url);
  const evaluatedAt = asTrimmedString(input.evaluated_at);
  const errors = [];

  if (!OWNED_REPO.test(sourceRepo)) errors.push('source_repo must be an owned jussray repository');
  if (!EXACT_COMMIT_SHA.test(sourceCommitSha)) errors.push('source_commit_sha must be an exact 40-character commit SHA');
  if (!draftText) errors.push('draft_text is required');
  if (draftText.length > 3000) errors.push('draft_text exceeds 3000 characters');
  if (!ALLOWED_STORY_TYPES.has(storyType)) errors.push('story_type is not supported');
  if (publicProofUrl && !HTTPS_URL.test(publicProofUrl)) errors.push('public_proof_url must be HTTPS when supplied');
  if (publicProofUrl) errors.push(...scanPublicText(publicProofUrl, 'public_proof_url'));

  if (errors.length > 0) reject(errors);

  const currentYou = validateCurrentYou(input.current_you, evaluatedAt);
  const freshness = validateFreshness(input, evaluatedAt);
  const internalEvidence = validateInternalEvidence(input, sourceRepo, sourceCommitSha);
  const publicClaims = normalizeClaims(input.public_claims, internalEvidence, sourceCommitSha);
  const sauceGuard = validateSauceGuard(input, draftText);

  const publicPayload = {
    platform: asTrimmedString(input.platform).toLowerCase() || 'linkedin',
    story_type: storyType,
    draft_text: draftText,
    public_claims: publicClaims,
    proof_link: publicProofUrl || null,
    proof_link_policy: 'editorial_optional',
  };
  const source = { repo: sourceRepo, commit_sha: sourceCommitSha };
  const identity = founderContentProposalIdentity({
    source,
    currentYou,
    freshness,
    publicPayload,
    internalEvidence,
    sauceGuard,
  });

  return {
    version: 1,
    kind: 'chief-ai/founder-content-proposal',
    source,
    freshness,
    public_payload: publicPayload,
    internal_evidence: internalEvidence,
    sauce_guard: sauceGuard,
    authority: {
      proposal_only: true,
      publish_authorized: false,
      current_you_source: currentYou.source,
      current_you_intent_id: currentYou.intent_id,
      current_you_intent_version: currentYou.intent_version,
      current_you_observed_at: currentYou.observed_at,
      proposal_evaluated_at: currentYou.evaluated_at,
      future_you_advisory_only: true,
      historical_content_intent_authoritative: false,
      analytics_feedback_authority: 'observation-only',
      analytics_can_authorize_publish: false,
      external_feedback_trusted_for_authority: false,
    },
    proposal_hash: computeFounderContentProposalHash(identity),
  };
}
