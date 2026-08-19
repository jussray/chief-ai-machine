const HASH = /^[0-9a-f]{64}$/i;
const IDENTIFIER = /^[a-z0-9][a-z0-9._:-]{0,119}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MAX_MARKET_CONTEXT_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const ALLOWED_MARKET_SOURCES = new Set([
  'external-research',
  'founder-observation',
  'not-required',
]);
const FORBIDDEN_KEYS = new Set([
  'raw_post_text',
  'raw_past_post_text',
  'raw_feed_text',
  'raw_diff',
  'raw_provider_payload',
  'private_prompt',
  'chain_of_thought',
  'credentials',
  'secret',
  'customer_data',
  'private_metrics',
  'internal_notes',
]);
const SECRET_LIKE = /(gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~+/-]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|(?:api|access|auth)[_-]?token\s*[:=]\s*\S+)/i;
const PRIVATE_DETAIL = /\b(?:system prompt|private prompt|chain[- ]of[- ]thought|raw diff|database password|service[_ -]?role|provider payload|environment variable|secret algorithm|routing weights?|scoring formula)\b/i;

function text(value, max = 240) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function reject(errors) {
  throw Object.assign(new Error(`FOUNDER_CONTENT_STRATEGY_REJECTED: ${errors.join('; ')}`), {
    code: 'FOUNDER_CONTENT_STRATEGY_REJECTED',
    details: errors,
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseTime(value, label) {
  const raw = text(value, 64);
  if (!ISO_DATE.test(raw)) reject([`${label} must be ISO UTC`]);
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) reject([`${label} must be a valid timestamp`]);
  return { raw: new Date(ms).toISOString(), ms };
}

function list(value, field, { required = false, max = 20, itemMax = 160 } = {}) {
  const items = Array.isArray(value)
    ? value.map((item) => text(item, itemMax)).filter(Boolean)
    : [];
  if (required && items.length === 0) reject([`${field} must contain at least one value`]);
  if (items.length > max) reject([`${field} may contain at most ${max} values`]);
  return [...new Set(items)];
}

function scanText(value, field) {
  const findings = [];
  if (SECRET_LIKE.test(value)) findings.push(`${field} contains secret-like material`);
  if (PRIVATE_DETAIL.test(value)) findings.push(`${field} contains proprietary implementation detail`);
  if (value.includes('```')) findings.push(`${field} contains a code block`);
  return findings;
}

function scanList(values, field) {
  return values.flatMap((value) => scanText(value, field));
}

function findForbiddenKeys(value, path = 'input', findings = []) {
  if (!isRecord(value) && !Array.isArray(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(key)) findings.push(`${childPath} is forbidden in founder content strategy input`);
    if (isRecord(child) || Array.isArray(child)) findForbiddenKeys(child, childPath, findings);
  }
  return findings;
}

function pattern(value) {
  return text(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function patternSignature(input = {}) {
  const parts = [
    pattern(input.hook_pattern),
    pattern(input.frame_pattern),
    pattern(input.proof_pattern),
    pattern(input.closing_pattern),
  ];
  if (parts.some((part) => !part)) {
    reject(['strategy hook_pattern, frame_pattern, proof_pattern, and closing_pattern are required']);
  }
  return parts.join('|');
}

function normalizePriorPatternSignatures(value) {
  return list(value, 'own_history.recent_pattern_signatures', { max: 30 }).map((signature, index) => {
    const parts = signature.split('|').map(pattern);
    if (parts.length !== 4 || parts.some((part) => !part)) {
      reject([`own_history.recent_pattern_signatures[${index}] must contain hook|frame|proof|closing`]);
    }
    return parts.join('|');
  });
}

function validateAudience(input = {}) {
  const primarySegment = text(input.primary_segment, 160);
  const desiredImpression = text(input.desired_impression, 240);
  const desiredAction = text(input.desired_action, 240);
  const caresAbout = list(input.cares_about, 'audience.cares_about', { required: true, max: 12, itemMax: 240 });
  const skepticisms = list(input.skepticisms, 'audience.skepticisms', { max: 12, itemMax: 240 });
  const credibilitySignals = list(input.credibility_signals, 'audience.credibility_signals', { required: true, max: 12, itemMax: 240 });
  const errors = [];
  if (!primarySegment) errors.push('audience.primary_segment is required');
  if (!desiredImpression) errors.push('audience.desired_impression is required');
  if (!desiredAction) errors.push('audience.desired_action is required');
  errors.push(...scanText(primarySegment, 'audience.primary_segment'));
  errors.push(...scanText(desiredImpression, 'audience.desired_impression'));
  errors.push(...scanText(desiredAction, 'audience.desired_action'));
  errors.push(...scanList(caresAbout, 'audience.cares_about'));
  errors.push(...scanList(skepticisms, 'audience.skepticisms'));
  errors.push(...scanList(credibilitySignals, 'audience.credibility_signals'));
  if (errors.length > 0) reject(errors);
  return {
    primary_segment: primarySegment,
    cares_about: caresAbout,
    skepticisms,
    credibility_signals: credibilitySignals,
    desired_impression: desiredImpression,
    desired_action: desiredAction,
  };
}

function validateOwnHistory(input = {}, evaluated) {
  const observed = parseTime(input.observed_at, 'own_history.observed_at');
  const digest = text(input.history_digest, 64).toLowerCase();
  const postCount = Number(input.post_count);
  const lastPublishedRaw = text(input.last_published_at, 64);
  const lastPublished = lastPublishedRaw ? parseTime(lastPublishedRaw, 'own_history.last_published_at') : null;
  const recentPatternSignatures = normalizePriorPatternSignatures(input.recent_pattern_signatures);
  const learningSignalHashes = list(input.learning_signal_hashes, 'own_history.learning_signal_hashes', { max: 20, itemMax: 64 })
    .map((value) => value.toLowerCase());
  const errors = [];

  if (!HASH.test(digest)) errors.push('own_history.history_digest must be sha256');
  if (!Number.isInteger(postCount) || postCount < 0) errors.push('own_history.post_count must be a non-negative integer');
  if (postCount === 0 && lastPublished) errors.push('own_history.last_published_at cannot exist when post_count is zero');
  if (Number.isInteger(postCount) && postCount >= 0 && recentPatternSignatures.length > postCount) {
    errors.push('own_history.recent_pattern_signatures cannot exceed post_count');
  }
  if (learningSignalHashes.some((value) => !HASH.test(value))) {
    errors.push('own_history.learning_signal_hashes must contain only sha256 values');
  }
  if (observed.ms > evaluated.ms + MAX_CLOCK_SKEW_MS) errors.push('own_history.observed_at is future-dated');
  if (lastPublished && observed.ms < lastPublished.ms) {
    errors.push('own_history must be observed at or after the latest published post so the next post learns from it');
  }
  if (errors.length > 0) reject(errors);

  return {
    observed_at: observed.raw,
    history_digest: digest,
    post_count: postCount,
    last_published_at: lastPublished?.raw ?? null,
    recent_pattern_signatures: recentPatternSignatures,
    learning_signal_hashes: learningSignalHashes,
  };
}

function validateMarketContext(input = {}, evaluated) {
  const required = input.required === true;
  const sourceClass = text(input.source_class, 80).toLowerCase() || (required ? '' : 'not-required');
  if (!required) {
    if (sourceClass !== 'not-required') {
      reject(['market_context.source_class must be not-required when market context is not required']);
    }
    return {
      required: false,
      source_class: 'not-required',
      source_trust: 'not-applicable',
      observed_at: null,
      expires_at: null,
      feed_digest: null,
      source_count: 0,
      crowded_patterns: [],
      repeated_hooks: [],
      emerging_conversations: [],
    };
  }

  const observed = parseTime(input.observed_at, 'market_context.observed_at');
  const digest = text(input.feed_digest, 64).toLowerCase();
  const sourceCount = Number(input.source_count);
  const crowdedPatterns = list(input.crowded_patterns, 'market_context.crowded_patterns', { max: 30, itemMax: 240 })
    .map(pattern)
    .filter(Boolean);
  const repeatedHooks = list(input.repeated_hooks, 'market_context.repeated_hooks', { max: 30, itemMax: 240 });
  const emergingConversations = list(input.emerging_conversations, 'market_context.emerging_conversations', { max: 30, itemMax: 240 });
  const errors = [];

  if (!ALLOWED_MARKET_SOURCES.has(sourceClass) || sourceClass === 'not-required') {
    errors.push('market_context.source_class must be external-research or founder-observation when required');
  }
  if (!HASH.test(digest)) errors.push('market_context.feed_digest must be sha256');
  if (!Number.isInteger(sourceCount) || sourceCount < 1) errors.push('market_context.source_count must be at least 1');
  if (observed.ms > evaluated.ms + MAX_CLOCK_SKEW_MS) errors.push('market_context.observed_at is future-dated');
  if (evaluated.ms - observed.ms > MAX_MARKET_CONTEXT_AGE_MS) {
    errors.push('market_context is stale; re-observe what relevant people are posting now');
  }
  errors.push(...scanList(repeatedHooks, 'market_context.repeated_hooks'));
  errors.push(...scanList(emergingConversations, 'market_context.emerging_conversations'));
  if (errors.length > 0) reject(errors);

  return {
    required: true,
    source_class: sourceClass,
    source_trust: 'submitted-unverified',
    observed_at: observed.raw,
    expires_at: new Date(observed.ms + MAX_MARKET_CONTEXT_AGE_MS).toISOString(),
    feed_digest: digest,
    source_count: sourceCount,
    crowded_patterns: [...new Set(crowdedPatterns)],
    repeated_hooks: repeatedHooks,
    emerging_conversations: emergingConversations,
  };
}

export function buildFounderContentStrategyLease(input = {}) {
  const evaluated = parseTime(input.evaluated_at, 'evaluated_at');
  const errors = findForbiddenKeys(input);
  if (errors.length > 0) reject(errors);

  const audience = validateAudience(input.audience);
  const ownHistory = validateOwnHistory(input.own_history, evaluated);
  const marketContext = validateMarketContext(input.market_context, evaluated);
  const strategy = input.strategy && typeof input.strategy === 'object' ? input.strategy : {};
  const currentPatternSignature = patternSignature(strategy);
  const selectedAngle = pattern(strategy.selected_angle);
  const improvementExperiment = text(strategy.improvement_experiment, 240);
  const retiredPatterns = list(strategy.retired_patterns, 'strategy.retired_patterns', { max: 12, itemMax: 240 });
  const counterPosition = strategy.counter_position === true;
  const counterPositionReason = text(strategy.counter_position_reason, 240);
  const verifiedClaimIds = new Set(list(input.verified_public_claim_ids, 'verified_public_claim_ids', { required: true, max: 12 })
    .map((value) => value.toLowerCase()));
  const bragClaimIds = list(strategy.brag_claim_ids, 'strategy.brag_claim_ids', { required: true, max: 4 })
    .map((value) => value.toLowerCase());
  const strategyErrors = [];

  if (!selectedAngle) strategyErrors.push('strategy.selected_angle is required');
  if (!improvementExperiment) strategyErrors.push('strategy.improvement_experiment is required so each post upgrades the next one');
  if (counterPosition && !counterPositionReason) {
    strategyErrors.push('strategy.counter_position_reason is required when counter_position is true');
  }
  strategyErrors.push(...scanText(improvementExperiment, 'strategy.improvement_experiment'));
  strategyErrors.push(...scanText(counterPositionReason, 'strategy.counter_position_reason'));
  strategyErrors.push(...scanList(retiredPatterns, 'strategy.retired_patterns'));
  if (ownHistory.recent_pattern_signatures.includes(currentPatternSignature)) {
    strategyErrors.push('strategy repeats an exact recent hook/frame/proof/closing signature; choose a new pattern');
  }
  if (marketContext.required && marketContext.crowded_patterns.includes(selectedAngle) && !counterPosition) {
    strategyErrors.push('strategy.selected_angle is currently crowded; choose a fresher angle or explicitly use a counter-position');
  }
  for (const claimId of bragClaimIds) {
    if (!IDENTIFIER.test(claimId)) strategyErrors.push(`strategy.brag_claim_ids contains invalid claim id ${claimId}`);
    if (!verifiedClaimIds.has(claimId)) {
      strategyErrors.push(`strategy brag claim ${claimId} is not backed by a verified public claim`);
    }
  }
  if (strategyErrors.length > 0) reject(strategyErrors);

  return Object.freeze({
    version: 1,
    kind: 'chief-ai/founder-content-strategy-lease',
    state: 'CURRENT',
    evaluated_at: evaluated.raw,
    expires_at: marketContext.expires_at,
    audience,
    own_history: {
      observed_at: ownHistory.observed_at,
      history_digest: ownHistory.history_digest,
      post_count: ownHistory.post_count,
      last_published_at: ownHistory.last_published_at,
      learning_signal_hashes: ownHistory.learning_signal_hashes,
    },
    market_context: {
      required: marketContext.required,
      source_class: marketContext.source_class,
      source_trust: marketContext.source_trust,
      observed_at: marketContext.observed_at,
      expires_at: marketContext.expires_at,
      feed_digest: marketContext.feed_digest,
      source_count: marketContext.source_count,
      crowded_pattern_count: marketContext.crowded_patterns.length,
      repeated_hook_count: marketContext.repeated_hooks.length,
      emerging_conversation_count: marketContext.emerging_conversations.length,
    },
    strategy: {
      selected_angle: selectedAngle,
      pattern_signature: currentPatternSignature,
      counter_position: counterPosition,
      counter_position_reason: counterPositionReason || null,
      brag_claim_ids: bragClaimIds,
      retired_patterns: retiredPatterns,
      improvement_experiment: improvementExperiment,
    },
    invalidates_on: [
      'new-own-post',
      'market-context-expiry-when-required',
      'audience-change',
      'draft-strategy-change',
    ],
    privacy: {
      raw_past_post_text_retained: false,
      raw_market_feed_text_retained: false,
      private_evidence_retained: false,
      learning_signal_payloads_retained: false,
    },
    authority: {
      advisory_only: true,
      truth_authority: false,
      publish_authorized: false,
      analytics_authority: 'observation-only',
      history_authority: 'advisory-only',
      market_context_authority: marketContext.required ? 'submitted-unverified' : 'not-applicable',
      strategy_evidence_is_not_claim_proof: true,
      may_select_story: true,
      may_relax_truth_gate: false,
      may_relax_sauce_guard: false,
    },
    analytics: {
      own_post_count: ownHistory.post_count,
      recent_pattern_count: ownHistory.recent_pattern_signatures.length,
      learning_signal_count: ownHistory.learning_signal_hashes.length,
      crowded_pattern_count: marketContext.crowded_patterns.length,
      repeated_hook_count: marketContext.repeated_hooks.length,
      emerging_conversation_count: marketContext.emerging_conversations.length,
      retired_pattern_count: retiredPatterns.length,
      has_improvement_experiment: true,
      has_proof_backed_brag: bragClaimIds.length > 0,
    },
  });
}

export function bindStrategyLeaseToProposal(strategyLease = {}, proposal = {}, useContext = {}) {
  const errors = [];
  if (strategyLease.kind !== 'chief-ai/founder-content-strategy-lease' || strategyLease.state !== 'CURRENT') {
    errors.push('strategy lease must be a CURRENT chief-ai/founder-content-strategy-lease');
  }
  if (strategyLease.authority?.advisory_only !== true || strategyLease.authority?.publish_authorized !== false) {
    errors.push('strategy lease must remain advisory and non-authorizing');
  }

  const boundAt = parseTime(useContext.bound_at, 'use_context.bound_at');
  const currentHistoryDigest = text(useContext.current_history_digest, 64).toLowerCase();
  if (!HASH.test(currentHistoryDigest)) errors.push('use_context.current_history_digest must be sha256');
  if (currentHistoryDigest !== text(strategyLease.own_history?.history_digest, 64).toLowerCase()) {
    errors.push('strategy own-post memory changed after lease creation; rebuild strategy from the latest published history');
  }
  const expiresRaw = text(strategyLease.expires_at, 64);
  if (expiresRaw) {
    const expires = parseTime(expiresRaw, 'strategy_lease.expires_at');
    if (boundAt.ms >= expires.ms) {
      errors.push('strategy lease expired before proposal use; refresh current market context');
    }
  }

  if (proposal.kind !== 'chief-ai/founder-content-proposal') {
    errors.push('proposal must be a canonical chief-ai/founder-content-proposal');
  }
  const proposalHash = text(proposal.proposal_hash, 64).toLowerCase();
  if (!HASH.test(proposalHash)) errors.push('proposal.proposal_hash must be sha256');

  const publicClaims = Array.isArray(proposal.public_payload?.public_claims)
    ? proposal.public_payload.public_claims
    : [];
  const verifiedPublicClaimIds = new Set(publicClaims
    .filter((claim) => claim?.truth_state === 'verified' && claim?.public_safe === true)
    .map((claim) => text(claim?.claim_id, 120).toLowerCase())
    .filter(Boolean));
  const bragClaimIds = Array.isArray(strategyLease.strategy?.brag_claim_ids)
    ? strategyLease.strategy.brag_claim_ids.map((value) => text(value, 120).toLowerCase()).filter(Boolean)
    : [];

  for (const claimId of bragClaimIds) {
    if (!verifiedPublicClaimIds.has(claimId)) {
      errors.push(`strategy brag claim ${claimId} is absent from the final verified public claim set`);
    }
  }
  if (errors.length > 0) reject(errors);

  return Object.freeze({
    version: 1,
    kind: 'chief-ai/founder-content-strategy-binding',
    strategy_evaluated_at: text(strategyLease.evaluated_at, 64),
    bound_at: boundAt.raw,
    own_history_digest: currentHistoryDigest,
    proposal_hash: proposalHash,
    brag_claim_ids: bragClaimIds,
    pattern_signature: text(strategyLease.strategy?.pattern_signature, 520),
    authority: {
      advisory_only: true,
      truth_authority: false,
      publish_authorized: false,
    },
  });
}
