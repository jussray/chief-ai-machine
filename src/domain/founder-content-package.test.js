import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildStrategyAwareFounderContentPackage,
  founderContentDraftFingerprint,
} from './founder-content-package.js';

const SHA = 'e'.repeat(40);
const EVIDENCE_REF = `github:chief-ai-machine@${SHA}#strategy-package`;
const HISTORY_DIGEST = 'a'.repeat(64);
const V4_SUBJECT_HASH = '2'.repeat(64);
const V4_OBSERVATION_HASH = '3'.repeat(64);
const V4_LEARNING_HASH = createHash('sha256')
  .update(`ultrathink/v4-advisory-handoff@v0\n${V4_SUBJECT_HASH}\n${V4_OBSERVATION_HASH}\nATTESTED`)
  .digest('hex');
const V4_HANDOFF = Object.freeze({
  schema: 'ultrathink/v4-advisory-handoff@v0',
  evidenceLevel: 'ATTESTED',
  subjectHash: V4_SUBJECT_HASH,
  observationHash: V4_OBSERVATION_HASH,
  learningHash: V4_LEARNING_HASH,
});

const proposalInput = {
  source_repo: 'jussray/chief-ai-machine',
  source_commit_sha: SHA,
  platform: 'linkedin',
  story_type: 'founder-progress',
  issued_at: '2026-08-19T06:40:00.000Z',
  expires_at: '2026-08-20T06:40:00.000Z',
  draft_text: 'I fixed a truth-decay failure in the way my product prepares founder progress stories.',
  public_claims: [{
    claim_id: 'truth-decay-fix',
    text: 'I fixed a truth-decay guard in the founder-content workflow at this source version.',
    truth_state: 'verified',
    public_safe: true,
    evidence_ref: EVIDENCE_REF,
    evidence_scope: 'truth-decay-fix',
    temporal_class: 'historical_version',
    temporal_version: SHA,
  }],
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
    cares_about: ['truthful agent systems', 'verification before autonomy'],
    skepticisms: ['self-reported proof'],
    credibility_signals: ['exact-version evidence', 'bounded authority'],
    desired_impression: 'The product catches stale truth instead of recycling it.',
    desired_action: 'Start a technical conversation about verified agent systems.',
  },
  own_history: {
    observed_at: '2026-08-19T06:35:00.000Z',
    history_digest: HISTORY_DIGEST,
    post_count: 18,
    last_published_at: '2026-08-19T05:30:00.000Z',
    recent_pattern_signatures: ['contrarian-opening|governance-frame|exact-head-proof|question-close'],
    learning_signal_hashes: ['4'.repeat(64)],
    recent_draft_fingerprints: [],
  },
  market_context: {
    required: true,
    source_class: 'external-research',
    observed_at: '2026-08-19T06:20:00.000Z',
    feed_digest: 'b'.repeat(64),
    source_count: 12,
    crowded_patterns: ['agents-are-the-future'],
    repeated_hooks: ['my agent runs everything'],
    emerging_conversations: ['proof-bound agents'],
  },
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

const visualDirection = {
  creative_mode: 'cinematic-proof',
  form: 'short-video-9x16',
  emotional_intent: ['wonder', 'revelation'],
  visual_hook: 'A luminous proof signal crosses a dark system and stops at an unresolved boundary.',
  scene_concept: 'Treat verification as a living signal moving through a vast night-time system, where the stop itself becomes the dramatic event.',
  motion_language: 'Slow drift, sudden stop, restrained bloom, then a quiet pull-back.',
  memory_line: 'Stopping correctly is a capability.',
  human_outcome: 'Help the viewer distinguish task completion from verified outcome.',
  proof_object: 'Exact-version evidence receipt',
  proof_truth_boundary: 'The receipt proves source-level exact-version behavior, not production outcome.',
  targets: ['linkedin', 'tiktok', 'youtube-shorts'],
  preserves_human_agency: true,
  uses_manipulative_dark_patterns: false,
};

const useContext = {
  bound_at: '2026-08-19T06:45:00.000Z',
  current_history_digest: HISTORY_DIGEST,
};

function build(overrides = {}) {
  return buildStrategyAwareFounderContentPackage({
    proposal_input: proposalInput,
    strategy_input: strategyInput,
    visual_direction: visualDirection,
    use_context: useContext,
    ...overrides,
  });
}

describe('strategy-aware founder content package', () => {
  it('composes strategy + visual direction with the canonical truth proposal while keeping both advisory', () => {
    const result = build();
    expect(result.kind).toBe('chief-ai/founder-content-strategy-aware-package');
    expect(result.proposal.kind).toBe('chief-ai/founder-content-proposal');
    expect(result.strategy_binding.proposal_hash).toBe(result.proposal.proposal_hash);
    expect(result.strategy_binding.draft_fingerprint).toBe(founderContentDraftFingerprint(proposalInput.draft_text));
    expect(result.strategy_lease.audience.cares_about).toContain('truthful agent systems');
    expect(result.strategy_lease.market_context.source_trust).toBe('submitted-unverified');
    expect(result.strategy_lease.strategy.brag_claim_ids).toEqual(['truth-decay-fix']);
    expect(result.visual_direction.creative_mode).toBe('cinematic-proof');
    expect(result.visual_direction.attack_2000.reasoning_pressure_budget).toBe(2000);
    expect(result.visual_direction.doctrine.proof_is_anchor_not_default_composition).toBe(true);
    expect(result.authority.canonical_publication_authority_object).toBe('proposal');
    expect(result.authority.strategy_sidecars_advisory_only).toBe(true);
    expect(result.authority.strategy_can_authorize_publish).toBe(false);
    expect(result.authority.strategy_can_change_proposal_hash).toBe(false);
    expect(result.authority.visual_direction_can_authorize_publish).toBe(false);
    expect(result.authority.visual_direction_can_expand_claim_scope).toBe(false);
  });

  it('fails closed when visual direction is omitted instead of silently defaulting to literal proof cards', () => {
    expect(() => build({ visual_direction: undefined })).toThrow(/FOUNDER_CONTENT_VISUAL_REJECTED/);
  });

  it('rejects a scene that merely repeats the post thesis', () => {
    expect(() => build({
      visual_direction: { ...visualDirection, scene_concept: proposalInput.draft_text },
    })).toThrow(/interpret the thesis rather than restate it literally/);
  });

  it('feeds only a validated FCR V4 learning hash into strategy memory', () => {
    const result = build({ v4_advisory_handoff: V4_HANDOFF });

    expect(result.strategy_lease.own_history.learning_signal_hashes).toEqual([
      '4'.repeat(64),
      V4_LEARNING_HASH,
    ]);
    const encoded = JSON.stringify(result);
    expect(encoded).not.toContain(V4_SUBJECT_HASH);
    expect(encoded).not.toContain(V4_OBSERVATION_HASH);
  });

  it('rejects V4 authority laundering and raw-payload smuggling', () => {
    expect(() => build({
      v4_advisory_handoff: { ...V4_HANDOFF, evidenceLevel: 'VERIFIED_CURRENT' },
    })).toThrow(/ATTESTED ceiling/);

    expect(() => build({
      v4_advisory_handoff: { ...V4_HANDOFF, raw_metrics: { impressions: 999 } },
    })).toThrow(/non-advisory fields/);
  });

  it('does not trust caller-supplied verified brag IDs over the final canonical proposal', () => {
    expect(() => build({
      strategy_input: {
        ...strategyInput,
        verified_public_claim_ids: ['secret-sauce'],
        strategy: { ...strategyInput.strategy, brag_claim_ids: ['secret-sauce'] },
      },
    })).toThrow(/not backed by a verified public claim/);
  });

  it('blocks an exact or trivially reformatted repeat of a recent canonical public draft', () => {
    const fingerprint = founderContentDraftFingerprint(proposalInput.draft_text);
    expect(fingerprint).toBe(founderContentDraftFingerprint(`  ${proposalInput.draft_text.toUpperCase()}   `));
    expect(() => build({
      strategy_input: {
        ...strategyInput,
        own_history: { ...strategyInput.own_history, recent_draft_fingerprints: [fingerprint] },
      },
    })).toThrow(/repeats a recent normalized draft/);
  });

  it('rejects malformed draft-fingerprint memory instead of silently skipping it', () => {
    expect(() => build({
      strategy_input: {
        ...strategyInput,
        own_history: { ...strategyInput.own_history, recent_draft_fingerprints: ['not-a-hash'] },
      },
    })).toThrow(/must contain only sha256 fingerprints/);
  });

  it('rejects private raw strategy payloads before they can become advisory memory', () => {
    expect(() => build({
      strategy_input: {
        ...strategyInput,
        market_context: { ...strategyInput.market_context, raw_feed_text: 'private feed capture' },
      },
    })).toThrow(/raw_feed_text is forbidden/);
  });
});
