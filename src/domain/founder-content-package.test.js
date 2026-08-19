import { describe, expect, it } from 'vitest';
import { buildStrategyAwareFounderContentPackage } from './founder-content-package.js';

const SHA = 'e'.repeat(40);
const EVIDENCE_REF = `github:chief-ai-machine@${SHA}#strategy-package`;
const HISTORY_DIGEST = 'a'.repeat(64);

const proposalInput = {
  source_repo: 'jussray/chief-ai-machine',
  source_commit_sha: SHA,
  platform: 'linkedin',
  story_type: 'founder-progress',
  issued_at: '2026-08-19T06:40:00.000Z',
  expires_at: '2026-08-20T06:40:00.000Z',
  draft_text: 'I fixed a truth-decay failure in the way my product prepares founder progress stories.',
  public_claims: [
    {
      claim_id: 'truth-decay-fix',
      text: 'I fixed a truth-decay guard in the founder-content workflow at this source version.',
      truth_state: 'verified',
      public_safe: true,
      evidence_ref: EVIDENCE_REF,
      evidence_scope: 'truth-decay-fix',
      temporal_class: 'historical_version',
      temporal_version: SHA,
    },
  ],
  internal_evidence: {
    verified: true,
    ref: EVIDENCE_REF,
    kind: 'github-exact-head-contract',
    digest: '1'.repeat(64),
    not_for_publication: true,
    source_repo: 'jussray/chief-ai-machine',
    source_commit_sha: SHA,
    proves: ['truth-decay-fix'],
    does_not_prove: ['production-runtime', 'traction', 'revenue'],
  },
  sauce_guard: {
    private_implementation_removed: true,
    secret_material_removed: true,
    raw_diff_removed: true,
    private_metrics_removed: true,
    unreleased_roadmap_removed: true,
    customer_private_data_removed: true,
    security_sensitive_details_removed: true,
    public_claims_only: true,
    withheld_categories: ['private-implementation', 'private-prompt'],
  },
  current_you: {
    authenticated: true,
    intent_id: 'strategy-package-current-intent',
    intent_version: 1,
    source: 'current_authenticated_founder',
    observed_at: '2026-08-19T06:35:00.000Z',
  },
  evaluated_at: '2026-08-19T06:40:00.000Z',
};

const strategyInput = {
  evaluated_at: '2026-08-19T06:40:00.000Z',
  audience: {
    primary_segment: 'AI founders and technical operators',
    desired_impression: 'The product catches stale truth instead of recycling it.',
    desired_action: 'Start a technical conversation about verified agent systems.',
  },
  own_history: {
    observed_at: '2026-08-19T06:35:00.000Z',
    history_digest: HISTORY_DIGEST,
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
    crowded_patterns: ['agents-are-the-future'],
  },
  // Deliberately untrusted input. The package must derive this from the final
  // canonical truth proposal rather than believe the caller.
  verified_public_claim_ids: ['secret-sauce'],
  strategy: {
    selected_angle: 'once-true-can-become-a-lie',
    hook_pattern: 'failure-confession',
    frame_pattern: 'truth-decay-frame',
    proof_pattern: 'exact-version-proof',
    closing_pattern: 'builder-invitation',
    brag_claim_ids: ['truth-decay-fix'],
    retired_patterns: ['generic-ai-agent-hook'],
    improvement_experiment: 'Lead with the failure before the capability.',
  },
};

const useContext = {
  bound_at: '2026-08-19T06:45:00.000Z',
  current_history_digest: HISTORY_DIGEST,
};

describe('strategy-aware founder content package', () => {
  it('composes strategy with the canonical truth proposal while keeping strategy advisory', () => {
    const result = buildStrategyAwareFounderContentPackage({
      proposal_input: proposalInput,
      strategy_input: strategyInput,
      use_context: useContext,
    });

    expect(result.kind).toBe('chief-ai/founder-content-strategy-aware-package');
    expect(result.proposal.kind).toBe('chief-ai/founder-content-proposal');
    expect(result.strategy_binding.proposal_hash).toBe(result.proposal.proposal_hash);
    expect(result.strategy_lease.strategy.brag_claim_ids).toEqual(['truth-decay-fix']);
    expect(result.authority.canonical_publication_authority_object).toBe('proposal');
    expect(result.authority.strategy_sidecars_advisory_only).toBe(true);
    expect(result.authority.strategy_can_authorize_publish).toBe(false);
    expect(result.authority.strategy_can_change_proposal_hash).toBe(false);
  });

  it('does not trust caller-supplied verified brag IDs over the final canonical proposal', () => {
    expect(() => buildStrategyAwareFounderContentPackage({
      proposal_input: proposalInput,
      strategy_input: {
        ...strategyInput,
        verified_public_claim_ids: ['secret-sauce'],
        strategy: {
          ...strategyInput.strategy,
          brag_claim_ids: ['secret-sauce'],
        },
      },
      use_context: useContext,
    })).toThrow(/not backed by a verified public claim/);
  });
});
