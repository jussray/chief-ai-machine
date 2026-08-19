import { sha256Hex } from './capability-plan.js';

export const FOUNDER_CONTENT_STRATEGY_KIND = 'chief-ai/founder-content-strategy';

const HASH = /^[0-9a-f]{64}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9._-]{0,79}$/;
const ALLOWED_STORY_TYPES = new Set([
  'founder-progress',
  'product-learning',
  'technical-story',
  'business-learning',
]);
const ALLOWED_EVIDENCE_CLASSES = new Set([
  'repository',
  'runtime',
  'product-design',
  'analytics',
]);
const ALLOWED_DISCOURSE_SOURCES = new Set([
  'external-research',
  'founder-observation',
  'not-required',
]);
const MAX_DISCOURSE_AGE_MS = 72 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;
const SECRET_LIKE = /(gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9._~+/-]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----|(?:api|access|auth)[_-]?token\s*[:=]\s*\S+)/i;
const PRIVATE_DETAIL = /\b(?:system prompt|private prompt|chain[- ]of[- ]thought|raw diff|database password|service[_ -]?role|provider payload|environment variable|secret algorithm|routing weights?|scoring formula)\b/i;
const FORBIDDEN_KEYS = new Set([
  'raw_post_text',
  'raw_diff',
  'raw_provider_payload',
  'private_prompt',
  'chain_of_thought',
  'credentials',
  'secret',
  'customer_data',
  'private_metrics',
]);

function text(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function fail(errors) {
  throw Object.assign(new Error(`FOUNDER_CONTENT_STRATEGY_REJECTED: ${errors.join('; ')}`), {
    code: 'FOUNDER_CONTENT_STRATEGY_REJECTED',
    details: errors,
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringList(value, field, { required = false, max = 12, itemMax = 240 } = {}) {
  if (!Array.isArray(value)) {
    if (required) fail([`${field} must be an array`]);
    return [];
  }
  const values = [...new Set(value.map((item) => text(item, itemMax)).filter(Boolean))];
  if (required && values.length === 0) fail([`${field} must contain at least one value`]);
  if (values.length > max) fail([`${field} may contain at most ${max} values`]);
  return values;
}

function scanText(value, field) {
  const findings = [];
  if (SECRET_LIKE.test(value)) findings.push(`${field} contains secret-like material`);
  if (PRIVATE_DETAIL.test(value)) findings.push(`${field} contains proprietary implementation detail`);
  if (value.includes('```')) findings.push(`${field} contains a code block`);
  return findings;
}

function rejectForbiddenKeys(value, path = 'input', findings = []) {
  if (!isRecord(value) && !Array.isArray(value)) return findings;
  for (const [key, child] of Object.entries(value)) {
    const next = `${path}.${key}`;
    if (FORBIDDEN_KEYS.has(key)) findings.push(`${next} is forbidden`);
    if (isRecord(child) || Array.isArray(child)) rejectForbiddenKeys(child, next, findings);
  }
  return findings;
}

function validateAudience(input) {
  const audience = isRecord(input) ? input : {};
  const segment = text(audience.segment, 160).toLowerCase();
  const desiredImpression = text(audience.desired_impression, 500);
  const desiredAction = text(audience.desired_action, 300);
  const caresAbout = stringList(audience.cares_about, 'target_audience.cares_about', { required: true });
  const skepticisms = stringList(audience.skepticisms, 'target_audience.skepticisms');
  const credibilitySignals = stringList(audience.credibility_signals, 'target_audience.credibility_signals', { required: true });
  const errors = [];

  if (!IDENTIFIER.test(segment)) errors.push('target_audience.segment is invalid');
  if (!desiredImpression) errors.push('target_audience.desired_impression is required');
  if (!desiredAction) errors.push('target_audience.desired_action is required');
  for (const [field, values] of [
    ['target_audience.desired_impression', [desiredImpression]],
    ['target_audience.desired_action', [desiredAction]],
    ['target_audience.cares_about', caresAbout],
    ['target_audience.skepticisms', skepticisms],
    ['target_audience.credibility_signals', credibilitySignals],
  ]) {
    for (const value of values) errors.push(...scanText(value, field));
  }
  if (errors.length) fail(errors);

  return Object.freeze({
    segment,
    cares_about: caresAbout,
    skepticisms,
    credibility_signals: credibilitySignals,
    desired_impression: desiredImpression,
    desired_action: desiredAction,
  });
}

function validateHistory(input) {
  const history = isRecord(input) ? input : {};
  const usedAngles = stringList(history.used_angles, 'history.used_angles', { max: 20 });
  const usedHookFamilies = stringList(history.used_hook_families, 'history.used_hook_families', { max: 20 });
  const usedProofStyles = stringList(history.used_proof_styles, 'history.used_proof_styles', { max: 20 });
  const usedCtaFamilies = stringList(history.used_cta_families, 'history.used_cta_families', { max: 20 });
  const learningSignalHashes = stringList(history.learning_signal_hashes, 'history.learning_signal_hashes', { max: 20, itemMax: 64 })
    .map((value) => value.toLowerCase());
  const errors = learningSignalHashes
    .filter((value) => !HASH.test(value))
    .map(() => 'history.learning_signal_hashes must contain SHA-256 values only');

  for (const [field, values] of [
    ['history.used_angles', usedAngles],
    ['history.used_hook_families', usedHookFamilies],
    ['history.used_proof_styles', usedProofStyles],
    ['history.used_cta_families', usedCtaFamilies],
  ]) {
    for (const value of values) errors.push(...scanText(value, field));
  }
  if (errors.length) fail(errors);

  return Object.freeze({
    used_angles: usedAngles,
    used_hook_families: usedHookFamilies,
    used_proof_styles: usedProofStyles,
    used_cta_families: usedCtaFamilies,
    learning_signal_hashes: learningSignalHashes,
  });
}

function validateDiscourse(input, evaluatedAt) {
  const discourse = isRecord(input) ? input : {};
  const required = discourse.required === true;
  const sourceClass = text(discourse.source_class, 80).toLowerCase() || (required ? '' : 'not-required');
  const observedAt = text(discourse.observed_at, 64) || null;
  const errors = [];

  if (!ALLOWED_DISCOURSE_SOURCES.has(sourceClass)) errors.push('discourse.source_class is invalid');
  if (required && sourceClass === 'not-required') errors.push('required discourse cannot use not-required source class');
  if (required && (!observedAt || !ISO_DATE.test(observedAt))) errors.push('required discourse needs an ISO UTC observed_at');

  if (observedAt) {
    if (!ISO_DATE.test(observedAt) || Number.isNaN(Date.parse(observedAt))) {
      errors.push('discourse.observed_at must be ISO UTC');
    } else if (ISO_DATE.test(evaluatedAt)) {
      const observed = Date.parse(observedAt);
      const evaluated = Date.parse(evaluatedAt);
      if (observed > evaluated + MAX_CLOCK_SKEW_MS) errors.push('discourse observation is future-dated');
      if (required && evaluated - observed > MAX_DISCOURSE_AGE_MS) errors.push('required discourse observation is stale');
    }
  }

  const crowdedAngles = stringList(discourse.crowded_angles, 'discourse.crowded_angles', { max: 20 });
  const repeatedHooks = stringList(discourse.repeated_hooks, 'discourse.repeated_hooks', { max: 20 });
  const emergingConversations = stringList(discourse.emerging_conversations, 'discourse.emerging_conversations', { max: 20 });
  for (const [field, values] of [
    ['discourse.crowded_angles', crowdedAngles],
    ['discourse.repeated_hooks', repeatedHooks],
    ['discourse.emerging_conversations', emergingConversations],
  ]) {
    for (const value of values) errors.push(...scanText(value, field));
  }
  if (errors.length) fail(errors);

  return Object.freeze({
    required,
    source_class: sourceClass,
    source_trust: sourceClass === 'not-required' ? 'not-applicable' : 'submitted-unverified',
    observed_at: observedAt,
    crowded_angles: crowdedAngles,
    repeated_hooks: repeatedHooks,
    emerging_conversations: emergingConversations,
  });
}

function validateBragCandidates(input) {
  if (!Array.isArray(input) || input.length === 0) fail(['brag_candidates must contain at least one candidate']);
  if (input.length > 8) fail(['brag_candidates may contain at most 8 candidates']);

  return input.map((candidate, index) => {
    const id = text(candidate?.id, 80).toLowerCase();
    const publicCapability = text(candidate?.public_capability, 500);
    const whyItMatters = text(candidate?.why_it_matters, 500);
    const evidenceClass = text(candidate?.evidence_class, 80).toLowerCase();
    const evidenceHash = text(candidate?.evidence_hash, 64).toLowerCase();
    const errors = [];

    if (!IDENTIFIER.test(id)) errors.push(`brag_candidates[${index}].id is invalid`);
    if (!publicCapability) errors.push(`brag_candidates[${index}].public_capability is required`);
    if (!whyItMatters) errors.push(`brag_candidates[${index}].why_it_matters is required`);
    if (!ALLOWED_EVIDENCE_CLASSES.has(evidenceClass)) errors.push(`brag_candidates[${index}].evidence_class is invalid`);
    if (!HASH.test(evidenceHash)) errors.push(`brag_candidates[${index}].evidence_hash must be SHA-256`);
    if (candidate?.private_recipe_withheld !== true) errors.push(`brag_candidates[${index}].private_recipe_withheld must be true`);
    errors.push(...scanText(publicCapability, `brag_candidates[${index}].public_capability`));
    errors.push(...scanText(whyItMatters, `brag_candidates[${index}].why_it_matters`));
    if (errors.length) fail(errors);

    return Object.freeze({
      id,
      public_capability: publicCapability,
      why_it_matters: whyItMatters,
      evidence_class: evidenceClass,
      evidence_hash: evidenceHash,
      evidence_trust: 'submitted-unverified',
      evidence_hash_role: 'advisory-reference-only',
      private_recipe_withheld: true,
    });
  });
}

function canonicalIdentity(value) {
  return {
    version: 1,
    kind: FOUNDER_CONTENT_STRATEGY_KIND,
    platform: value.platform,
    story_type: value.story_type,
    evaluated_at: value.evaluated_at,
    target_audience: value.target_audience,
    history: value.history,
    discourse: value.discourse,
    brag_candidates: value.brag_candidates,
    selected_angle: value.selected_angle,
    differentiation: value.differentiation,
    selected_brag_id: value.selected_brag_id,
    experiment: value.experiment,
  };
}

/**
 * Builds an advisory strategy receipt that may guide drafting but cannot prove a
 * public claim, renew stale truth, approve copy, or publish. Exact-copy truth and
 * publication authority remain in the founder-content proposal + FCR boundary.
 */
export function buildFounderContentStrategy(input = {}) {
  const platform = text(input.platform, 80).toLowerCase() || 'linkedin';
  const storyType = text(input.story_type, 80).toLowerCase();
  const evaluatedAt = text(input.evaluated_at, 64);
  const selectedAngle = text(input.selected_angle, 500);
  const differentiation = text(input.differentiation, 700);
  const selectedBragId = text(input.selected_brag_id, 80).toLowerCase();
  const experiment = text(input.experiment, 500);
  const errors = rejectForbiddenKeys(input);

  if (!ALLOWED_STORY_TYPES.has(storyType)) errors.push('story_type is not supported');
  if (!ISO_DATE.test(evaluatedAt) || Number.isNaN(Date.parse(evaluatedAt))) errors.push('evaluated_at must be ISO UTC');
  if (!selectedAngle) errors.push('selected_angle is required');
  if (!differentiation) errors.push('differentiation is required');
  if (!IDENTIFIER.test(selectedBragId)) errors.push('selected_brag_id is invalid');
  if (!experiment) errors.push('experiment is required');
  errors.push(...scanText(selectedAngle, 'selected_angle'));
  errors.push(...scanText(differentiation, 'differentiation'));
  errors.push(...scanText(experiment, 'experiment'));
  if (errors.length) fail(errors);

  const targetAudience = validateAudience(input.target_audience);
  const history = validateHistory(input.history);
  const discourse = validateDiscourse(input.discourse, evaluatedAt);
  const bragCandidates = validateBragCandidates(input.brag_candidates);
  if (!bragCandidates.some((candidate) => candidate.id === selectedBragId)) {
    fail(['selected_brag_id must identify one brag candidate']);
  }

  const identity = canonicalIdentity({
    platform,
    story_type: storyType,
    evaluated_at: evaluatedAt,
    target_audience: targetAudience,
    history,
    discourse,
    brag_candidates: bragCandidates,
    selected_angle: selectedAngle,
    differentiation,
    selected_brag_id: selectedBragId,
    experiment,
  });

  return Object.freeze({
    ...identity,
    strategy_hash: sha256Hex(JSON.stringify(identity)),
    authority: Object.freeze({
      advisory_only: true,
      can_publish: false,
      can_approve_copy: false,
      can_mutate_content: false,
      can_renew_truth: false,
      can_upgrade_authority: false,
      strategy_evidence_is_not_claim_proof: true,
      analytics_authority: 'observation-only',
      history_authority: 'advisory-only',
      discourse_authority: 'advisory-only',
      exact_copy_proposal_required_before_publication: true,
      current_founder_authority_required_for_external_action: true,
    }),
  });
}
