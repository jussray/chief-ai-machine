import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildSocialAnalyticsDecisionInput,
  validateFcrSocialAnalyticsReceipt,
} from './social-analytics-decision.js';

const METRICS = [
  'impressions', 'views', 'reach', 'likes', 'comments', 'shares', 'saves', 'profile_actions', 'follower_change',
];

function sha(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function receipt({ postId = 'post-control', views = 100, windowKind = 'post_lifetime', accountId = '@juss_fn_ray', definition = 'Provider-native content views for the bound post.' } = {}) {
  const metrics = Object.fromEntries(METRICS.map((key) => [key, null]));
  const metricStates = Object.fromEntries(METRICS.map((key) => [key, 'UNKNOWN']));
  const metricDefinitions = Object.fromEntries(METRICS.map((key) => [key, null]));
  metrics.views = views;
  metricStates.views = 'observed';
  metricDefinitions.views = definition;

  const identity = {
    version: 1,
    kind: 'fcr/social-analytics-observation@v1',
    source_observation_hash: 'a'.repeat(64),
    platform: 'instagram',
    provider: 'instagram-cli',
    account_id: accountId,
    scope: 'post',
    post_id: postId,
    observed_at: '2026-10-03T18:00:00.000Z',
    window: {
      kind: windowKind,
      start: null,
      end: null,
    },
    metrics,
    metric_states: metricStates,
    metric_definitions: metricDefinitions,
    evidence_refs: [`instagram-cli:${postId}`],
    truth_state: 'OBSERVED',
  };

  return {
    ...identity,
    receipt_hash: sha(identity),
    authority: {
      observation_only: true,
      learning_authority: 'advisory_only',
      can_publish: false,
      can_schedule: false,
      can_change_content: false,
      can_override_product_gates: false,
      can_increase_authority: false,
      missing_metrics_are_unknown: true,
    },
  };
}

describe('Chief social analytics decision adapter', () => {
  it('consumes the exact FCR receipt hash instead of prose evidence', () => {
    const control = receipt();
    const challenger = receipt({ postId: 'post-challenger', views: 140 });
    const decision = buildSocialAnalyticsDecisionInput({ control, challenger, primary_metric: 'views' });

    expect(decision.control_receipt_hash).toBe(control.receipt_hash);
    expect(decision.challenger_receipt_hash).toBe(challenger.receipt_hash);
    expect(decision.comparison_state).toBe('COMPATIBLE');
    expect(decision.control_value).toBe(100);
    expect(decision.challenger_value).toBe(140);
    expect(decision.recommendation).toBe('MEASURE');
    expect(decision.authority.publish_authorized).toBe(false);
  });

  it('rejects a tampered account even when every other field looks valid', () => {
    const source = receipt();
    expect(() => validateFcrSocialAnalyticsReceipt({ ...source, account_id: '@jussnco' }))
      .toThrow(/receipt_hash does not match exact FCR receipt identity/);
  });

  it('refuses cross-account winner claims', () => {
    const decision = buildSocialAnalyticsDecisionInput({
      control: receipt(),
      challenger: receipt({ postId: 'post-other', accountId: '@jussnco', views: 1000 }),
      primary_metric: 'views',
    });
    expect(decision.comparison_state).toBe('UNRESOLVED');
    expect(decision.incompatibility_reasons).toContain('account-mismatch');
    expect(decision.recommendation).toBe('UNRESOLVED');
  });

  it('refuses a rolling-window versus post-lifetime comparison', () => {
    const rolling = receipt({ postId: 'post-rolling', windowKind: 'rolling_30d' });
    rolling.window = {
      kind: 'rolling_30d',
      start: '2026-09-04T18:00:00.000Z',
      end: '2026-10-03T18:00:00.000Z',
    };
    const identity = {
      version: rolling.version,
      kind: rolling.kind,
      source_observation_hash: rolling.source_observation_hash,
      platform: rolling.platform,
      provider: rolling.provider,
      account_id: rolling.account_id,
      scope: rolling.scope,
      post_id: rolling.post_id,
      observed_at: rolling.observed_at,
      window: rolling.window,
      metrics: rolling.metrics,
      metric_states: rolling.metric_states,
      metric_definitions: rolling.metric_definitions,
      evidence_refs: rolling.evidence_refs,
      truth_state: rolling.truth_state,
    };
    rolling.receipt_hash = sha(identity);

    const decision = buildSocialAnalyticsDecisionInput({
      control: receipt(),
      challenger: rolling,
      primary_metric: 'views',
    });
    expect(decision.comparison_state).toBe('UNRESOLVED');
    expect(decision.incompatibility_reasons).toContain('window-kind-mismatch');
  });

  it('refuses metric-definition drift even when the metric name matches', () => {
    const decision = buildSocialAnalyticsDecisionInput({
      control: receipt(),
      challenger: receipt({
        postId: 'post-challenger',
        views: 140,
        definition: 'A differently defined metric that merely shares the name views.',
      }),
      primary_metric: 'views',
    });
    expect(decision.comparison_state).toBe('UNRESOLVED');
    expect(decision.incompatibility_reasons).toContain('metric-definition-mismatch');
  });
});
