import { describe, expect, it } from 'vitest';
import { buildFounderContentStrategyLease } from './founder-content-strategy-lease.js';

const base = {
  evaluated_at: '2026-08-19T07:20:00.000Z',
  audience: {
    primary_segment: 'technical-founders',
    cares_about: ['truthful agent systems'],
    skepticisms: ['self-reported proof'],
    credibility_signals: ['bounded authority'],
    desired_impression: 'The system separates recommendation from authority.',
    desired_action: 'Inspect the public capability rather than the private implementation.',
  },
  own_history: {
    observed_at: '2026-08-19T07:10:00.000Z',
    history_digest: 'a'.repeat(64),
    post_count: 4,
    last_published_at: '2026-08-19T06:00:00.000Z',
    recent_pattern_signatures: ['failure-first|governance-frame|sanitized-receipt|technical-discussion'],
    learning_signal_hashes: ['4'.repeat(64)],
  },
  market_context: {
    required: true,
    source_class: 'external-research',
    observed_at: '2026-08-19T07:00:00.000Z',
    feed_digest: 'b'.repeat(64),
    source_count: 3,
    crowded_patterns: ['agent-autonomy'],
    repeated_hooks: ['my agent runs everything'],
    emerging_conversations: ['proof-bound agents'],
  },
  verified_public_claim_ids: ['bounded-learning'],
  strategy: {
    selected_angle: 'feedback-loop-without-more-authority',
    hook_pattern: 'failure-first-v2',
    frame_pattern: 'bounded-learning-frame',
    proof_pattern: 'verified-capability-receipt',
    closing_pattern: 'technical-invitation',
    brag_claim_ids: ['bounded-learning'],
    retired_patterns: ['generic-autonomy-brag'],
    improvement_experiment: 'Use one verified capability-level brag and no implementation disclosure.',
  },
};

describe('founder content strategy lease red-team', () => {
  it('sauce-guards historical strategy memory so it cannot reintroduce private mechanics', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: {
        ...base.strategy,
        retired_patterns: ['The exact private prompt and routing weights were the old angle.'],
      },
    })).toThrow(/proprietary implementation detail/);
  });

  it('keeps market context and strategy evidence advisory rather than authoritative', () => {
    const lease = buildFounderContentStrategyLease(base);

    expect(lease.market_context.source_trust).toBe('submitted-unverified');
    expect(lease.authority.strategy_evidence_is_not_claim_proof).toBe(true);
    expect(lease.authority.advisory_only).toBe(true);
    expect(lease.authority.truth_authority).toBe(false);
    expect(lease.authority.publish_authorized).toBe(false);
    expect(lease.authority.may_relax_truth_gate).toBe(false);
    expect(lease.authority.may_relax_sauce_guard).toBe(false);
  });
});
