import { describe, expect, it } from 'vitest';
import {
  PROVIDER_LEARNING_RECEIPT_CONTRACT,
  PROVIDER_RUN_REQUEST_CONTRACT,
  buildProviderLearningReceipt,
  validateProviderRunRequest,
} from './provider-learning.js';

function providerRequest(overrides = {}) {
  return {
    contract: PROVIDER_RUN_REQUEST_CONTRACT,
    workspace_id: 'founder-control-room',
    project_id: 'chief-ai-machine',
    account_id: null,
    page_id: null,
    audience_segment: 'founder',
    asset_id: 'friend-mode-session-001',
    asset_version: 'v1',
    context_fingerprint: 'a'.repeat(64),
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    max_tokens: 512,
    timeout_ms: 5000,
    system: 'Use only supplied evidence.',
    messages: [{ role: 'user', content: 'Choose the next smallest action.' }],
    approval: {
      source_system: 'founder-control-room',
      founder_approved: true,
      execution_authorized: true,
      consequence: 'provider-billing',
      receipt_id: 'fcr-approval-001',
      approved_at: '2026-09-15T22:00:00.000Z',
    },
    ...overrides,
  };
}

function providerResult(overrides = {}) {
  return {
    provider: 'anthropic',
    api: 'messages',
    api_version: '2023-06-01',
    request_id: 'req_abc',
    provider_message_id: 'msg_abc',
    requested_model: 'claude-sonnet-5',
    resolved_model: 'claude-sonnet-5',
    output_text: 'Use the existing learning carrier.',
    content_types: ['text'],
    stop_reason: 'end_turn',
    usage: { input_tokens: 40, output_tokens: 12 },
    latency_ms: 910,
    observed_at: '2026-09-15T22:00:01.000Z',
    provenance_locked: true,
    ...overrides,
  };
}

describe('provider learning receipt', () => {
  it('requires an FCR founder-approved provider-billing receipt before execution', () => {
    expect(() => validateProviderRunRequest(providerRequest({
      approval: {
        source_system: 'founder-control-room',
        founder_approved: false,
        execution_authorized: true,
        consequence: 'provider-billing',
        receipt_id: 'fcr-approval-001',
        approved_at: '2026-09-15T22:00:00.000Z',
      },
    }))).toThrow(/founder_approved must be true/);
  });

  it('quarantines provider output and emits observed latency/token metrics', () => {
    const receipt = buildProviderLearningReceipt(providerRequest(), providerResult());

    expect(receipt.contract).toBe(PROVIDER_LEARNING_RECEIPT_CONTRACT);
    expect(receipt.state).toBe('QUARANTINED');
    expect(receipt.provider).toBe('anthropic');
    expect(receipt.context_fingerprint).toBe('a'.repeat(64));
    expect(receipt.prompt_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.output_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.continuity_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt).not.toHaveProperty('output_text');
    expect(receipt).not.toHaveProperty('messages');
    expect(receipt.metrics.map((metric) => [metric.metric_name, metric.value])).toEqual([
      ['provider_call', 1],
      ['latency_ms', 910],
      ['input_tokens', 40],
      ['output_tokens', 12],
    ]);
    expect(receipt.cost).toEqual(expect.objectContaining({ state: 'UNKNOWN', amount_usd: null }));
    expect(receipt.authority).toEqual(expect.objectContaining({
      provider_output_approved: false,
      promotion_allowed: false,
      learning_authority: 'advisory_only',
      may_increase_authority: false,
      may_execute_external_action: false,
      founder_review_required_for_promotion: true,
    }));
  });

  it('rejects model/provider output that tries to replace trusted provider identity', () => {
    expect(() => buildProviderLearningReceipt(providerRequest(), providerResult({
      provider: 'openai',
    }))).toThrow(/identity must be anthropic/);
  });

  it('rejects missing token usage instead of treating it as zero', () => {
    expect(() => buildProviderLearningReceipt(providerRequest(), providerResult({
      usage: { input_tokens: undefined, output_tokens: 12 },
    }))).toThrow(/token usage must contain non-negative integers/);
  });

  it('keeps historical approval receipt and asset identity in the learning receipt', () => {
    const receipt = buildProviderLearningReceipt(providerRequest({
      asset_id: 'decision-42',
      asset_version: 'rev-7',
    }), providerResult());
    expect(receipt.asset_id).toBe('decision-42');
    expect(receipt.asset_version).toBe('rev-7');
    expect(receipt.approval_receipt_id).toBe('fcr-approval-001');
  });
});
