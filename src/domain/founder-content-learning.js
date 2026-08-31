import { createHash } from 'node:crypto';

export const FCR_FOUNDER_CONTENT_OUTCOME_KIND = 'fcr/founder-content-outcome-observation';
export const CHIEF_FOUNDER_CONTENT_LEARNING_KIND = 'chief-ai/founder-content-learning-signal';

const HASH = /^[0-9a-f]{64}$/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const PROVIDER_STATES = new Set(['unknown', 'draft', 'scheduled', 'published', 'failed']);
export const FOUNDER_CONTENT_METRIC_KEYS = Object.freeze([
  'impressions',
  'reactions',
  'comments',
  'profile_views',
  'attributed_visits',
  'qualified_conversations',
  'attributed_contacts',
  'attributed_deals',
]);

const TOP_LEVEL_FIELDS = new Set([
  'version',
  'kind',
  'content_id',
  'authorization_hash',
  'public_payload_hash',
  'platform',
  'provider',
  'provider_state',
  'provider_receipt_id',
  'observed_at',
  'metrics',
  'metric_states',
  'observation_hash',
  'authority',
  'privacy',
]);
const AUTHORITY_FIELDS = new Set([
  'observation_only',
  'learning_authority',
  'can_authorize_publish',
  'can_change_content',
  'can_increase_authority',
  'missing_metrics_are_unknown',
]);
const PRIVACY_FIELDS = new Set([
  'raw_post_text_stored',
  'private_messages_stored',
  'raw_comments_stored',
  'provider_payload_stored',
  'customer_private_data_stored',
]);

function text(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function fail(errors) {
  throw Object.assign(new Error(`FOUNDER_CONTENT_LEARNING_REJECTED: ${errors.join('; ')}`), {
    code: 'FOUNDER_CONTENT_LEARNING_REJECTED',
    details: errors,
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function rejectUnknownKeys(value, allowed, path, errors) {
  if (!isRecord(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`);
  }
}

function normalizeMetrics(input = {}) {
  const metrics = {};
  const metricStates = {};
  const errors = [];
  const allowedMetricKeys = new Set(FOUNDER_CONTENT_METRIC_KEYS);

  if (!isRecord(input.metrics)) errors.push('metrics must be an object');
  if (!isRecord(input.metric_states)) errors.push('metric_states must be an object');
  rejectUnknownKeys(input.metrics, allowedMetricKeys, 'metrics', errors);
  rejectUnknownKeys(input.metric_states, allowedMetricKeys, 'metric_states', errors);

  for (const key of FOUNDER_CONTENT_METRIC_KEYS) {
    const value = input.metrics?.[key];
    const state = input.metric_states?.[key];

    if (value === undefined || value === null) {
      metrics[key] = null;
      metricStates[key] = 'UNKNOWN';
      if (state !== undefined && state !== 'UNKNOWN') {
        errors.push(`metric_states.${key} must be UNKNOWN when metrics.${key} is missing`);
      }
      continue;
    }

    if (!Number.isInteger(value) || value < 0) {
      errors.push(`metrics.${key} must be a non-negative integer or null`);
      continue;
    }
    if (state !== 'observed') {
      errors.push(`metric_states.${key} must be observed when metrics.${key} is present`);
    }
    metrics[key] = value;
    metricStates[key] = 'observed';
  }

  return { metrics, metricStates, errors };
}

export function validateFounderContentOutcomeObservation(input) {
  const errors = [];
  if (!isRecord(input)) fail(['observation must be an object']);

  rejectUnknownKeys(input, TOP_LEVEL_FIELDS, 'observation', errors);

  const contentId = text(input.content_id, 64);
  const authorizationHash = text(input.authorization_hash, 64).toLowerCase();
  const publicPayloadHash = text(input.public_payload_hash, 64).toLowerCase();
  const platform = text(input.platform, 80).toLowerCase();
  const provider = text(input.provider, 80).toLowerCase();
  const providerState = text(input.provider_state, 40).toLowerCase();
  const providerReceiptId = text(input.provider_receipt_id, 240) || null;
  const observedAt = text(input.observed_at, 64);
  const observationHash = text(input.observation_hash, 64).toLowerCase();

  if (input.version !== 1) errors.push('version must be 1');
  if (input.kind !== FCR_FOUNDER_CONTENT_OUTCOME_KIND) errors.push('unsupported outcome observation kind');
  if (!UUID.test(contentId)) errors.push('content_id must be a UUID');
  if (!HASH.test(authorizationHash)) errors.push('authorization_hash must be SHA-256');
  if (!HASH.test(publicPayloadHash)) errors.push('public_payload_hash must be SHA-256');
  if (!platform) errors.push('platform is required');
  if (!provider) errors.push('provider is required');
  if (!PROVIDER_STATES.has(providerState)) errors.push('provider_state is invalid');
  if (!ISO_DATE.test(observedAt) || Number.isNaN(Date.parse(observedAt))) errors.push('observed_at must be ISO UTC');
  if (providerState === 'published' && !providerReceiptId) {
    errors.push('provider_receipt_id is required when provider_state is published');
  }

  const normalizedMetrics = normalizeMetrics(input);
  errors.push(...normalizedMetrics.errors);

  const authority = isRecord(input.authority) ? input.authority : {};
  if (!isRecord(input.authority)) errors.push('authority must be an object');
  rejectUnknownKeys(authority, AUTHORITY_FIELDS, 'authority', errors);
  if (authority.observation_only !== true) errors.push('authority.observation_only must be true');
  if (authority.learning_authority !== 'advisory_only') errors.push('authority.learning_authority must be advisory_only');
  if (authority.can_authorize_publish !== false) errors.push('authority.can_authorize_publish must be false');
  if (authority.can_change_content !== false) errors.push('authority.can_change_content must be false');
  if (authority.can_increase_authority !== false) errors.push('authority.can_increase_authority must be false');
  if (authority.missing_metrics_are_unknown !== true) errors.push('authority.missing_metrics_are_unknown must be true');

  const privacy = isRecord(input.privacy) ? input.privacy : {};
  if (!isRecord(input.privacy)) errors.push('privacy must be an object');
  rejectUnknownKeys(privacy, PRIVACY_FIELDS, 'privacy', errors);
  for (const field of PRIVACY_FIELDS) {
    if (privacy[field] !== false) errors.push(`privacy.${field} must be false`);
  }

  const identity = {
    version: 1,
    content_id: contentId,
    authorization_hash: authorizationHash,
    public_payload_hash: publicPayloadHash,
    platform,
    provider,
    provider_state: providerState,
    provider_receipt_id: providerReceiptId,
    observed_at: observedAt,
    metrics: normalizedMetrics.metrics,
    metric_states: normalizedMetrics.metricStates,
  };

  if (!HASH.test(observationHash)) errors.push('observation_hash must be SHA-256');
  else if (hash(identity) !== observationHash) errors.push('observation_hash does not match outcome identity');

  if (errors.length > 0) fail(errors);
  return Object.freeze({ ...identity, observation_hash: observationHash });
}

export function buildFounderContentLearningSignal(input) {
  const observation = validateFounderContentOutcomeObservation(input);
  const observedMetrics = FOUNDER_CONTENT_METRIC_KEYS
    .filter((key) => observation.metric_states[key] === 'observed')
    .map((key) => Object.freeze({ name: key, value: observation.metrics[key] }));
  const unknownMetrics = FOUNDER_CONTENT_METRIC_KEYS.filter(
    (key) => observation.metric_states[key] === 'UNKNOWN',
  );

  const signalIdentity = {
    version: 1,
    kind: CHIEF_FOUNDER_CONTENT_LEARNING_KIND,
    declared_source_system: 'founder-control-room',
    source_trust: 'submitted-unverified',
    source_authentication_verified: false,
    source_kind: FCR_FOUNDER_CONTENT_OUTCOME_KIND,
    source_observation_hash: observation.observation_hash,
    content_id: observation.content_id,
    platform: observation.platform,
    provider: observation.provider,
    provider_state: observation.provider_state,
    provider_receipt_id: observation.provider_receipt_id,
    observed_at: observation.observed_at,
    observed_metrics: observedMetrics,
    unknown_metrics: unknownMetrics,
  };

  return Object.freeze({
    ...signalIdentity,
    learning_hash: hash(signalIdentity),
    authority: Object.freeze({
      evidence_only: true,
      learning_authority: 'advisory_only',
      execution_authorized: false,
      publish_authorized: false,
      content_mutation_authorized: false,
      may_increase_authority: false,
      authenticated_source_required_for_canonical_learning: true,
      founder_approval_required_for_external_action: true,
    }),
  });
}
