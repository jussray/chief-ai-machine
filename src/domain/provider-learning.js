import { createHash } from 'node:crypto';
import { createMetricObservation } from './metric-observation.js';

export const PROVIDER_RUN_REQUEST_CONTRACT = 'juss-v10/provider-run-request@v1';
export const PROVIDER_LEARNING_RECEIPT_CONTRACT = 'juss-v10/provider-learning-receipt@v1';

const HASH = /^[0-9a-f]{64}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

function text(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function nullableText(value, max = 1000) {
  const normalized = text(value, max);
  return normalized || null;
}

function hash(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function fail(errors) {
  throw Object.assign(new Error(`PROVIDER_RUN_REJECTED: ${errors.join('; ')}`), {
    code: 'PROVIDER_RUN_REJECTED',
    details: errors,
  });
}

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function promptHash(input) {
  return hash({
    system: typeof input.system === 'string' ? input.system : null,
    messages: Array.isArray(input.messages)
      ? input.messages.map((item) => ({ role: item?.role, content: item?.content }))
      : [],
  });
}

export function validateProviderRunRequest(input) {
  const errors = [];
  if (!isRecord(input)) fail(['request must be an object']);
  const approval = isRecord(input.approval) ? input.approval : {};
  const contextFingerprint = text(input.context_fingerprint, 64).toLowerCase();
  const approvedAt = text(approval.approved_at, 64);

  if (input.contract !== PROVIDER_RUN_REQUEST_CONTRACT) errors.push('unsupported provider run contract');
  if (input.provider !== 'anthropic') errors.push('provider must be anthropic for this adapter');
  if (!text(input.workspace_id, 160)) errors.push('workspace_id is required');
  if (!text(input.project_id, 160)) errors.push('project_id is required');
  if (!text(input.asset_id, 240)) errors.push('asset_id is required');
  if (!text(input.asset_version, 120)) errors.push('asset_version is required');
  if (!HASH.test(contextFingerprint)) errors.push('context_fingerprint must be SHA-256');
  if (!text(input.model, 160)) errors.push('model is required');
  if (!Array.isArray(input.messages) || input.messages.length < 1) errors.push('messages are required');
  if (approval.source_system !== 'founder-control-room') errors.push('approval.source_system must be founder-control-room');
  if (approval.founder_approved !== true) errors.push('approval.founder_approved must be true');
  if (approval.execution_authorized !== true) errors.push('approval.execution_authorized must be true');
  if (approval.consequence !== 'provider-billing') errors.push('approval.consequence must be provider-billing');
  if (!text(approval.receipt_id, 320)) errors.push('approval.receipt_id is required');
  if (!ISO_DATE.test(approvedAt) || Number.isNaN(Date.parse(approvedAt))) errors.push('approval.approved_at must be ISO UTC');
  if (errors.length > 0) fail(errors);

  return Object.freeze({
    contract: PROVIDER_RUN_REQUEST_CONTRACT,
    workspace_id: text(input.workspace_id, 160),
    project_id: text(input.project_id, 160),
    account_id: nullableText(input.account_id, 240),
    page_id: nullableText(input.page_id, 240),
    audience_segment: nullableText(input.audience_segment, 240),
    asset_id: text(input.asset_id, 240),
    asset_version: text(input.asset_version, 120),
    context_fingerprint: contextFingerprint,
    provider: 'anthropic',
    model: text(input.model, 160),
    max_tokens: input.max_tokens,
    timeout_ms: input.timeout_ms,
    system: typeof input.system === 'string' ? input.system : undefined,
    messages: input.messages,
    prompt_hash: promptHash(input),
    approval: Object.freeze({
      source_system: 'founder-control-room',
      founder_approved: true,
      execution_authorized: true,
      consequence: 'provider-billing',
      receipt_id: text(approval.receipt_id, 320),
      approved_at: approvedAt,
    }),
  });
}

export function buildProviderLearningReceipt(validatedRequest, providerResult) {
  const request = validateProviderRunRequest(validatedRequest);
  const errors = [];
  if (!providerResult || providerResult.provider !== 'anthropic') errors.push('provider result identity must be anthropic');
  if (providerResult?.provenance_locked !== true) errors.push('provider result provenance must be locked');
  if (!ISO_DATE.test(providerResult?.observed_at || '') || Number.isNaN(Date.parse(providerResult?.observed_at))) {
    errors.push('provider result observed_at must be ISO UTC');
  }
  if (errors.length > 0) fail(errors);

  const provenanceRef = `anthropic:${providerResult.request_id || providerResult.provider_message_id}`;
  const idempotencyBase = providerResult.request_id || providerResult.provider_message_id;
  const metricContext = {
    timestamp: providerResult.observed_at,
    source: 'anthropic-api',
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    account_id: request.account_id,
    page_id: request.page_id,
    audience_segment: request.audience_segment,
    provenance_ref: provenanceRef,
  };
  const metrics = [
    createMetricObservation({
      ...metricContext,
      metric_name: 'provider_call', unit: 'count', value: 1,
      idempotency_key: `${idempotencyBase}:provider_call`,
    }),
    createMetricObservation({
      ...metricContext,
      metric_name: 'latency_ms', unit: 'ms', value: providerResult.latency_ms,
      idempotency_key: `${idempotencyBase}:latency_ms`,
    }),
    createMetricObservation({
      ...metricContext,
      metric_name: 'input_tokens', unit: 'tokens', value: providerResult.usage?.input_tokens ?? 0,
      idempotency_key: `${idempotencyBase}:input_tokens`,
    }),
    createMetricObservation({
      ...metricContext,
      metric_name: 'output_tokens', unit: 'tokens', value: providerResult.usage?.output_tokens ?? 0,
      idempotency_key: `${idempotencyBase}:output_tokens`,
    }),
  ];

  const identity = {
    contract: PROVIDER_LEARNING_RECEIPT_CONTRACT,
    state: 'QUARANTINED',
    workspace_id: request.workspace_id,
    project_id: request.project_id,
    asset_id: request.asset_id,
    asset_version: request.asset_version,
    context_fingerprint: request.context_fingerprint,
    prompt_hash: request.prompt_hash,
    provider: 'anthropic',
    api_version: providerResult.api_version,
    requested_model: providerResult.requested_model,
    resolved_model: providerResult.resolved_model,
    provider_request_id: providerResult.request_id,
    provider_message_id: providerResult.provider_message_id,
    observed_at: providerResult.observed_at,
    output_hash: hash(providerResult.output_text || ''),
    approval_receipt_id: request.approval.receipt_id,
    metric_hashes: metrics.map((metric) => metric.observation_hash),
  };

  return Object.freeze({
    ...identity,
    continuity_fingerprint: hash(identity),
    metrics: Object.freeze(metrics),
    cost: Object.freeze({
      state: 'UNKNOWN',
      amount_usd: null,
      reason: 'Anthropic Messages responses do not provide authoritative billed cost in this receipt.',
    }),
    authority: Object.freeze({
      provider_output_approved: false,
      promotion_allowed: false,
      learning_authority: 'advisory_only',
      may_increase_authority: false,
      may_execute_external_action: false,
      founder_review_required_for_promotion: true,
    }),
  });
}
