import { describe, expect, it } from 'vitest';
import {
  bindStrategyLeaseToProposal,
  buildFounderContentStrategyLease,
} from './founder-content-strategy-lease.js';

const HISTORY_DIGEST = 'a'.repeat(64);
const base = {
  evaluated_at: '2026-08-19T06:40:00.000Z',
  audience: {
    primary_segment: 'AI founders and technical operators',
    cares_about: ['truthful agent systems', 'bounded execution authority'],
    skepticisms: ['self-reported proof'],
    credibility_signals: ['exact-version evidence', 'fail-closed authority'],
    desired_impression: 'This founder builds unusually rigorous product systems.',
    desired_action: 'Follow the build and start a high-signal technical conversation.',
  },
  own_history: {
    observed_at: '2026-08-19T06:35:00.000Z',
    history_digest: HISTORY_DIGEST,
    post_count: 18,
    last_published_at: '2026-08-19T05:30:00.000Z',
    recent_pattern_signatures: [
      'contrarian-opening|governance-frame|exact-head-proof|question-close',
    ],
    learning_signal_hashes: ['4'.repeat(64)],
  },
  market_context: {
    required: true,
    source_class: 'external-research',
    observed_at: '2026-08-19T06:20:00.000Z',
    feed_digest: 'b'.repeat(64),
    source_count: 12,
    crowded_patterns: ['agents-are-the-future', 'build-in-public-update'],
    repeated_hooks: ['my agent runs everything'],
    emerging_conversations: ['proof-bound agents'],
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

const proposal = {
  kind: 'chief-ai/founder-content-proposal',
  proposal_hash: 'c'.repeat(64),
  public_payload: {
    public_claims: [
      { claim_id: 'truth-decay-fix', truth_state: 'verified', public_safe: true },
      { claim_id: 'sauce-guard', truth_state: 'verified', public_safe: true },
    ],
  },
};

const useContext = {
  bound_at: '2026-08-19T06:45:00.000Z',
  current_history_digest: HISTORY_DIGEST,
};

describe('founder content strategy lease', () => {
  it('creates a current advisory-only strategy receipt without raw post or feed text', () => {
    const lease = buildFounderContentStrategyLease(base);
    expect(lease.kind).toBe('chief-ai/founder-content-strategy-lease');
    expect(lease.state).toBe('CURRENT');
    expect(lease.expires_at).toBe('2026-08-20T06:20:00.000Z');
    expect(lease.audience.primary_segment).toContain('AI founders');
    expect(lease.audience.cares_about).toContain('truthful agent systems');
    expect(lease.audience.credibility_signals).toContain('exact-version evidence');
    expect(lease.market_context.source_trust).toBe('submitted-unverified');
    expect(lease.authority.strategy_evidence_is_not_claim_proof).toBe(true);
    expect(lease.own_history.learning_signal_hashes).toEqual(['4'.repeat(64)]);
    expect(lease.strategy.brag_claim_ids).toEqual(['truth-decay-fix']);
    expect(lease.strategy.pattern_signature).toBe('failure-confession|truth-decay-frame|exact-version-proof|builder-invitation');
    expect(lease.privacy.raw_past_post_text_retained).toBe(false);
    expect(lease.privacy.raw_market_feed_text_retained).toBe(false);
    expect(lease.privacy.learning_signal_payloads_retained).toBe(false);
    expect(lease.authority.advisory_only).toBe(true);
    expect(lease.authority.publish_authorized).toBe(false);
    expect(lease.authority.may_relax_truth_gate).toBe(false);
    expect(lease.authority.may_relax_sauce_guard).toBe(false);
  });

  it('fails closed when own-post memory predates the latest published artifact', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      own_history: { ...base.own_history, observed_at: '2026-08-19T05:00:00.000Z' },
    })).toThrow(/observed at or after the latest published post/);
  });

  it('normalizes prior signatures so casing and punctuation cannot hide an exact repeat', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      own_history: {
        ...base.own_history,
        recent_pattern_signatures: ['Failure Confession | Truth Decay Frame | Exact Version Proof | Builder Invitation'],
      },
    })).toThrow(/repeats an exact recent/);
  });

  it('rejects malformed own-history shape that could fake post memory', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      own_history: { ...base.own_history, post_count: 0 },
    })).toThrow(/last_published_at cannot exist when post_count is zero/);
  });

  it('requires learning memory to remain hash-only advisory evidence', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      own_history: { ...base.own_history, learning_signal_hashes: ['not-a-hash'] },
    })).toThrow(/learning_signal_hashes must contain only sha256 values/);
  });

  it('blocks old strategy memory from reintroducing private implementation details', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: {
        ...base.strategy,
        retired_patterns: ['The private prompt and routing weights were the old hook.'],
      },
    })).toThrow(/proprietary implementation detail/);
  });

  it('rejects forbidden raw/private fields even when nested', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      own_history: { ...base.own_history, raw_post_text: 'full old post' },
    })).toThrow(/raw_post_text is forbidden/);
  });

  it('requires audience cares-about and credibility signals instead of generic targeting', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      audience: { ...base.audience, cares_about: [] },
    })).toThrow(/audience\.cares_about must contain at least one value/);
    expect(() => buildFounderContentStrategyLease({
      ...base,
      audience: { ...base.audience, credibility_signals: [] },
    })).toThrow(/audience\.credibility_signals must contain at least one value/);
  });

  it('rejects a crowded feed angle unless the strategy deliberately counter-positions it with a reason', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: { ...base.strategy, selected_angle: 'agents are the future' },
    })).toThrow(/currently crowded/);
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: { ...base.strategy, selected_angle: 'agents are the future', counter_position: true },
    })).toThrow(/counter_position_reason is required/);
    const counter = buildFounderContentStrategyLease({
      ...base,
      strategy: {
        ...base.strategy,
        selected_angle: 'agents are the future',
        counter_position: true,
        counter_position_reason: 'Challenge the category by showing that verification, not more autonomy, is the bottleneck.',
      },
    });
    expect(counter.strategy.counter_position_reason).toContain('verification');
  });

  it('requires current market observation when current context is part of the strategy', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      market_context: { ...base.market_context, observed_at: '2026-08-17T06:20:00.000Z' },
    })).toThrow(/market_context is stale/);
  });

  it('labels current discourse as advisory input rather than authenticated proof', () => {
    const lease = buildFounderContentStrategyLease(base);
    expect(lease.market_context.source_class).toBe('external-research');
    expect(lease.market_context.source_trust).toBe('submitted-unverified');
    expect(lease.authority.market_context_authority).toBe('submitted-unverified');
  });

  it('does not force feed research when current market context is irrelevant', () => {
    const lease = buildFounderContentStrategyLease({
      ...base,
      market_context: { required: false, source_class: 'not-required' },
    });
    expect(lease.market_context.required).toBe(false);
    expect(lease.market_context.source_trust).toBe('not-applicable');
    expect(lease.expires_at).toBeNull();
  });

  it('requires an explicit target audience', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      audience: { ...base.audience, primary_segment: '' },
    })).toThrow(/primary_segment is required/);
  });

  it('requires every strategic brag to point at a verified public claim candidate', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: { ...base.strategy, brag_claim_ids: ['secret-sauce'] },
    })).toThrow(/not backed by a verified public claim/);
  });

  it('requires one deliberate upgrade experiment for the next post', () => {
    expect(() => buildFounderContentStrategyLease({
      ...base,
      strategy: { ...base.strategy, improvement_experiment: '' },
    })).toThrow(/each post upgrades the next one/);
  });

  it('binds every brag to the final canonical truth proposal without making strategy authoritative', () => {
    const lease = buildFounderContentStrategyLease(base);
    const binding = bindStrategyLeaseToProposal(lease, proposal, useContext);
    expect(binding.proposal_hash).toBe(proposal.proposal_hash);
    expect(binding.own_history_digest).toBe(HISTORY_DIGEST);
    expect(binding.brag_claim_ids).toEqual(['truth-decay-fix']);
    expect(binding.authority.publish_authorized).toBe(false);
  });

  it('rejects a brag that disappears before the final truth proposal is built', () => {
    const lease = buildFounderContentStrategyLease(base);
    expect(() => bindStrategyLeaseToProposal(lease, {
      ...proposal,
      public_payload: { public_claims: proposal.public_payload.public_claims.filter((claim) => claim.claim_id !== 'truth-decay-fix') },
    }, useContext)).toThrow(/absent from the final verified public claim set/);
  });

  it('invalidates strategy when a newer own-post history digest appears before proposal use', () => {
    const lease = buildFounderContentStrategyLease(base);
    expect(() => bindStrategyLeaseToProposal(lease, proposal, {
      ...useContext,
      current_history_digest: 'd'.repeat(64),
    })).toThrow(/own-post memory changed after lease creation/);
  });

  it('invalidates strategy when required current-feed context expires before proposal use', () => {
    const lease = buildFounderContentStrategyLease(base);
    expect(() => bindStrategyLeaseToProposal(lease, proposal, {
      ...useContext,
      bound_at: '2026-08-20T06:20:00.000Z',
    })).toThrow(/strategy lease expired before proposal use/);
  });
});
