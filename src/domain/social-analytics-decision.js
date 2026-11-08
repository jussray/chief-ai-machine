import { createHash } from 'node:crypto';

export const FCR_SOCIAL_ANALYTICS_OBSERVATION_KIND = 'fcr/social-analytics-observation@v1';
export const CHIEF_SOCIAL_ANALYTICS_DECISION_KIND = 'chief-ai/social-analytics-decision-input@v1';

const HASH = /^[0-9a-f]{64}$/i;
const SOCIAL_METRIC_KEYS = Object.freeze([
  'impressions',
  'views',
  'reach',
  'likes',
  'comments',
  'shares',
  'saves',
  'profile_actions',
  'follower_change',
]);
const METRIC_SET = new Set(SOCIAL_METRIC_KEYS);
const WINDOW_KINDS = new Set([
  'post_lifetime',
  'rolling_7d',
  'rolling_30d',
  'rolling_90d',
  'calendar_month',
  'custom_range',
]);

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function text(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function fail(errors) {
  throw Object.assign(new Error(`SOCIAL_ANALYTICS_DECISION_REJECTED: ${errors.join('; ')}`), {
    code: 'SOCIAL_ANALYTICS_DECISION_REJECTED',
    details: errors,
  });
}

function orderedMetricObject(input) {
  const out = {};
  for (const key of SOCIAL_METRIC_KEYS) out[key] = input?.[key] ?? null;
  return out;
}

function validateMetricShape(metrics, states, definitions, errors) {
  if (!record(metrics)) errors.push('metrics must be an object');
  if (!record(states)) errors.push('metric_states must be an object');
  if (!record(definitions)) errors.push('metric_definitions must be an object');
  for (const key of SOCIAL_METRIC_KEYS) {
    const value = metrics?.[key];
    const state = states?.[key];
    const definition = definitions?.[key];
    if (value === null || value === undefined) {
      if (state !== 'UNKNOWN') errors.push(`metric_states.${key} must be UNKNOWN when missing`);
      if (definition !== null && definition !== undefined) errors.push(`metric_definitions.${key} must be null when missing`);
      continue;
    }
    if (!Number.isInteger(value)) errors.push(`metrics.${key} must be an integer or null`);
    if (key !== 'follower_change' && value < 0) errors.push(`metrics.${key} must be non-negative`);
    if (state !== 'observed') errors.push(`metric_states.${key} must be observed when present`);
    if (!text(definition, 500)) errors.push(`metric_definitions.${key} is required when observed`);
  }
}

export function validateFcrSocialAnalyticsReceipt(input) {
  const errors = [];
  if (!record(input)) fail(['receipt must be an object']);
  const window = record(input.window) || {};
  if (input.version !== 1) errors.push('version must be 1');
  if (input.kind !== FCR_SOCIAL_ANALYTICS_OBSERVATION_KIND) errors.push('unsupported FCR social analytics kind');
  if (!HASH.test(text(input.source_observation_hash, 64))) errors.push('source_observation_hash must be SHA-256');
  if (!text(input.platform, 80)) errors.push('platform is required');
  if (!text(input.provider, 80)) errors.push('provider is required');
  if (!text(input.account_id, 200)) errors.push('account_id is required');
  if (!['account', 'post'].includes(input.scope)) errors.push('scope must be account or post');
  if (input.scope === 'post' && !text(input.post_id, 200)) errors.push('post scope requires post_id');
  if (input.scope === 'account' && input.post_id !== null) errors.push('account scope must have post_id=null');
  if (!WINDOW_KINDS.has(window.kind)) errors.push('window.kind is invalid');
  if (!Array.isArray(input.evidence_refs) || input.evidence_refs.length === 0) errors.push('evidence_refs are required');
  validateMetricShape(input.metrics, input.metric_states, input.metric_definitions, errors);

  const authority = record(input.authority);
  if (!authority
      || authority.observation_only !== true
      || authority.learning_authority !== 'advisory_only'
      || authority.can_publish !== false
      || authority.can_schedule !== false
      || authority.can_change_content !== false
      || authority.can_override_product_gates !== false
      || authority.can_increase_authority !== false
      || authority.missing_metrics_are_unknown !== true) {
    errors.push('FCR social receipt authority must remain observation-only');
  }

  const identity = {
    version: 1,
    kind: FCR_SOCIAL_ANALYTICS_OBSERVATION_KIND,
    source_observation_hash: text(input.source_observation_hash, 64).toLowerCase(),
    platform: text(input.platform, 80).toLowerCase(),
    provider: text(input.provider, 80).toLowerCase(),
    account_id: text(input.account_id, 200),
    scope: input.scope,
    post_id: input.post_id ?? null,
    observed_at: input.observed_at,
    window: {
      kind: window.kind,
      start: window.start ?? null,
      end: window.end ?? null,
    },
    metrics: orderedMetricObject(input.metrics),
    metric_states: orderedMetricObject(input.metric_states),
    metric_definitions: orderedMetricObject(input.metric_definitions),
    evidence_refs: [...input.evidence_refs],
    truth_state: input.truth_state,
  };

  const receiptHash = text(input.receipt_hash, 64).toLowerCase();
  if (!HASH.test(receiptHash)) errors.push('receipt_hash must be SHA-256');
  else if (hash(identity) !== receiptHash) errors.push('receipt_hash does not match exact FCR receipt identity');

  if (errors.length > 0) fail(errors);
  return Object.freeze({ ...identity, receipt_hash: receiptHash });
}

function windowDuration(receipt) {
  if (!receipt.window.start || !receipt.window.end) return null;
  return Date.parse(receipt.window.end) - Date.parse(receipt.window.start);
}

/**
 * @param {{ control?: unknown, challenger?: unknown, primary_metric?: unknown }} [input]
 */
export function buildSocialAnalyticsDecisionInput(input = {}) {
  const { control, challenger, primary_metric } = input;
  const a = validateFcrSocialAnalyticsReceipt(control);
  const b = validateFcrSocialAnalyticsReceipt(challenger);
  const metric = text(primary_metric, 80);
  if (!METRIC_SET.has(metric)) fail(['primary_metric must be a supported social metric']);

  const reasons = [];
  if (a.platform !== b.platform) reasons.push('platform-mismatch');
  if (a.account_id !== b.account_id) reasons.push('account-mismatch');
  if (a.provider !== b.provider) reasons.push('provider-mismatch');
  if (a.scope !== b.scope) reasons.push('scope-mismatch');
  if (a.window.kind !== b.window.kind) reasons.push('window-kind-mismatch');
  const aDuration = windowDuration(a);
  const bDuration = windowDuration(b);
  if (aDuration !== null && bDuration !== null && aDuration !== bDuration) reasons.push('window-duration-mismatch');
  if (a.metric_states[metric] !== 'observed' || b.metric_states[metric] !== 'observed') reasons.push('primary-metric-unobserved');
  if (a.metric_definitions[metric] !== b.metric_definitions[metric]) reasons.push('metric-definition-mismatch');

  const identity = {
    version: 1,
    kind: CHIEF_SOCIAL_ANALYTICS_DECISION_KIND,
    source_system: 'founder-control-room',
    control_receipt_hash: a.receipt_hash,
    challenger_receipt_hash: b.receipt_hash,
    account_id: a.account_id,
    platform: a.platform,
    primary_metric: metric,
    comparison_state: reasons.length === 0 ? 'COMPATIBLE' : 'UNRESOLVED',
    incompatibility_reasons: reasons,
    control_value: a.metric_states[metric] === 'observed' ? a.metrics[metric] : null,
    challenger_value: b.metric_states[metric] === 'observed' ? b.metrics[metric] : null,
    recommendation: reasons.length === 0 ? 'MEASURE' : 'UNRESOLVED',
  };

  return Object.freeze({
    ...identity,
    decision_hash: hash(identity),
    authority: Object.freeze({
      evidence_only: true,
      learning_authority: 'advisory_only',
      execution_authorized: false,
      publish_authorized: false,
      content_mutation_authorized: false,
      may_increase_authority: false,
    }),
  });
}

export { SOCIAL_METRIC_KEYS };