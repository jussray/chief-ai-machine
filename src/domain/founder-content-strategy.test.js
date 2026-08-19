import { describe, expect, it } from 'vitest';
import { buildFounderContentStrategyLease } from './founder-content-strategy.js';

const base = {
  evaluated_at: '2026-08-19T06:40:00.000Z',
  audience: {
    primary_segment: 'AI founders and technical operators',
    desired_impression: 'This founder builds unusually rigorous product systems.',
    desired_action: 'Follow the build and start a high-signal technical conversation.',
  },
  own_history: {
    observed_at: '2026-08-19T06:35:00.000Z',
    history_digest: 'a'.repeat(64),
    post_count: 18,
    last_published_at: '2026-08-19T05:30:00.000Z',
    recent_pattern_signatures: [
      'contrarian-opening|governance-frame|exact-head-proof|question-close',
    ],
  },
  market_context: {
    required: true,
    observed_at: '2026-08-19T06:20:00.000Z',
    feed_digest: 'b'.repeat(64),
    source_count: 12,
    crowded_patterns: ['agents-are-the-future', 'build-in-public-update'],
  },
  verified_public_claim_ids: ['truth-decay-fix', 'sauce-guard'],
  strategy: {
    selected_angle: 'once-true-can-become-a-lie',
    hook_pattern: 'failure-confession',
    frame_pattern: 'truth-decay-frame',
    proof_pattern: 'exact-version-proof',
    closing_pattern: 'builder-invitation',
    counter_position: false,
    brag_claim_ids: ['truth-decay-fix'],
    retired_patterns: ['generic-ai-agent-hook'],
    improvement_experiment: 'Open with the failure mode before naming the product capability.',
  },
};

describe('founder content strategy lease', () => {
  it('creates a current advisory-only strategy receipt without raw post or feed text', () => {
    const lease = buildFounderContentStrategyLease(base);

    expect(lease.kind).toBe('chief-ai/founder-content-strategy-lease');
    expect(lease.state).toBe('CURRENT');
    expect(lease.audience.primary_segment).toContain('AI founders');
    expect(lease.strategy.brag_claim_ids).toEqual(['truth-decay-fix']);
    expect(lease.strategy.pattern_signature).toBe(
      'failure-confession|truth-decay-frame|exact-version-proof|builder-invitation',
    );
    expect(lease.privacy.raw_past_post_text_retained).toBe(false);
    expect(lease.privacy.raw_market_feed_text_retained).toBe(false);
    expect(lease.authority.advisory_only).toBe(true);
    expect(lease.authority.publish_authorized).toBe(false);
    expect(lease.authority.may_relax_truth_gate).toBe(false);
    expect(lease.authority.may_relax_sauce_guard).toBe(false);
  });

  it('fails closed when own-post memory predates the latest published artifact', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      own_history: {
        ...base.own_history,
        observed_at: '2026-08-19T05:00:00.000Z',
      },
    })).toThrow(/observed at or after the latest published post/);
  });

  it('rejects an exact recent strategy-pattern repeat', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      own_history: {
        ...base.own_history,
        recent_pattern_signatures: [
          'failure-confession|truth-decay-frame|exact-version-proof|builder-invitation',
        ],
      },
    })).toThrow(/repeats an exact recent/);
  });

  it('rejects a crowded feed angle unless the strategy deliberately counter-positions it', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: {
        ...base.strategy,
        selected_angle: 'agents are the future',
      },
    })).toThrow(/currently crowded/);

    const counter = buildFounderContentStrategyLease({
      ...base,
      strategy: {
        ...base.strategy,
        selected_angle: 'agents are the future',
        counter_position: true,
      },
    });
    expect(counter.strategy.counter_position).toBe(true);
  });

  it('requires current market observation when current context is part of the strategy', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      market_context: {
        ...base.market_context,
        observed_at: '2026-08-17T06:20:00.000Z',
      },
    })).toThrow(/market_context is stale/);
  });

  it('does not force feed research when current market context is irrelevant', () => {
    const lease = buildFounderContentStrategyLease({
      ...base,
      market_context: { required: false },
    });
    expect(lease.market_context.required).toBe(false);
    expect(lease.market_context.feed_digest).toBeNull();
  });

  it('requires an explicit target audience, intended impression, and desired action', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      audience: { ...base.audience, primary_segment: '' },
    })).toThrow(/primary_segment is required/);
  });

  it('requires every strategic brag to point at a verified public claim', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: {
        ...base.strategy,
        brag_claim_ids: ['secret-sauce'],
      },
    })).toThrow(/not backed by a verified public claim/);
  });

  it('requires one deliberate upgrade experiment for the next post', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: {
        ...base.strategy,
        improvement_experiment: '',
      },
    })).toThrow(/each post upgrades the next one/);
  });
});
