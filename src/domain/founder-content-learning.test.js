import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildFounderContentLearningSignal,
  validateFounderContentOutcomeObservation,
} from './founder-content-learning.js';

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function observation(overrides = {}) {
  const identity = {
    version: 1,
    content_id: '5f16b7e0-2d8f-4d2f-a6ce-07a9769dbd4e',
    authorization_hash: 'a'.repeat(64),
    public_payload_hash: 'b'.repeat(64),
    platform: 'linkedin',
    provider: 'buffer',
    provider_state: 'published',
    provider_receipt_id: 'buffer-post-123',
    observed_at: '2026-08-19T06:10:00.000Z',
    metrics: {
      impressions: 1200,
      reactions: 42,
      comments: 9,
      profile_views: 21,
      attributed_visits: 17,
      qualified_conversations: 3,
      attributed_contacts: 2,
      attributed_deals: null,
    },
    metric_states: {
      impressions: 'observed',
      reactions: 'observed',
      comments: 'observed',
      profile_views: 'observed',
      attributed_visits: 'observed',
      qualified_conversations: 'observed',
      attributed_contacts: 'observed',
      attributed_deals: 'UNKNOWN',
    },
    ...(overrides.identity ?? {}),
  };

  return {
    ...identity,
    kind: 'fcr/founder-content-outcome-observation',
    observation_hash: sha256(identity),
    authority: {
      observation_only: true,
      learning_authority: 'advisory_only',
      can_authorize_publish: false,
      can_change_content: false,
      can_increase_authority: false,
      missing_metrics_are_unknown: true,
    },
    privacy: {
      raw_post_text_stored: false,
      private_messages_stored: false,
      raw_comments_stored: false,
      provider_payload_stored: false,
      customer_private_data_stored: false,
    },
    ...(overrides.root ?? {}),
  };
}

describe('FCR founder-content learning adapter', () => {
  it('turns an exact FCR outcome observation into advisory-only Chief learning evidence', () => {
    const signal = buildFounderContentLearningSignal(observation());

    expect(signal.kind).toBe('chief-ai/founder-content-learning-signal');
    expect(signal.source_system).toBe('founder-control-room');
    expect(signal.provider_state).toBe('published');
    expect(signal.observed_metrics).toContainEqual({ name: 'qualified_conversations', value: 3 });
    expect(signal.unknown_metrics).toEqual(['attributed_deals']);
    expect(signal.learning_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(signal.authority).toEqual({
      evidence_only: true,
      learning_authority: 'advisory_only',
      execution_authorized: false,
      publish_authorized: false,
      content_mutation_authorized: false,
      may_increase_authority: false,
      founder_approval_required_for_external_action: true,
    });
  });

  it('rejects a tampered observation instead of learning from unbound metrics', () => {
    const input = observation();
    input.metrics.impressions = 999999;

    expect(() => validateFounderContentOutcomeObservation(input)).toThrow(
      /observation_hash does not match outcome identity/,
    );
  });

  it('rejects authority laundering from advisory evidence into publication authority', () => {
    const input = observation();
    input.authority.can_authorize_publish = true;

    expect(() => buildFounderContentLearningSignal(input)).toThrow(
      /can_authorize_publish must be false/,
    );
  });

  it('preserves missing metrics as UNKNOWN rather than manufacturing zero performance', () => {
    const input = observation({
      identity: {
        metrics: {
          impressions: 1200,
          reactions: null,
          comments: null,
          profile_views: null,
          attributed_visits: null,
          qualified_conversations: null,
          attributed_contacts: null,
          attributed_deals: null,
        },
        metric_states: {
          impressions: 'observed',
          reactions: 'UNKNOWN',
          comments: 'UNKNOWN',
          profile_views: 'UNKNOWN',
          attributed_visits: 'UNKNOWN',
          qualified_conversations: 'UNKNOWN',
          attributed_contacts: 'UNKNOWN',
          attributed_deals: 'UNKNOWN',
        },
      },
    });

    const signal = buildFounderContentLearningSignal(input);
    expect(signal.observed_metrics).toEqual([{ name: 'impressions', value: 1200 }]);
    expect(signal.unknown_metrics).toContain('qualified_conversations');
  });

  it('fails closed on unknown top-level or nested payload fields', () => {
    expect(() => buildFounderContentLearningSignal(
      observation({ root: { raw_post_text: 'private post copy' } }),
    )).toThrow(/observation.raw_post_text is not allowed/);

    const nested = observation();
    nested.metrics.private_notes = 'do not ingest me';
    expect(() => buildFounderContentLearningSignal(nested)).toThrow(
      /metrics.private_notes is not allowed/,
    );
  });

  it('rejects privacy claims that say sensitive payloads were stored', () => {
    const input = observation();
    input.privacy.provider_payload_stored = true;

    expect(() => buildFounderContentLearningSignal(input)).toThrow(
      /privacy.provider_payload_stored must be false/,
    );
  });
});
