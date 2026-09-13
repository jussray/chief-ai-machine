import { describe, expect, it } from 'vitest';
import { buildStrategyAwareFounderContentPackage } from '../src/domain/founder-content-package.js';
import { buildFounderContentStrategyLease } from '../src/domain/founder-content-strategy-lease.js';

const SOURCE_SHA = 'a'.repeat(40);
const HISTORY_DIGEST = 'b'.repeat(64);
const EVIDENCE_DIGEST = 'c'.repeat(64);
const EVIDENCE_REF = `github:chief-ai-machine@${SOURCE_SHA}#review-regression`;

function strategyInput(overrides = {}) {
  return {
    evaluated_at: '2026-09-13T18:00:00.000Z',
    audience: {
      primary_segment: 'AI founders',
      cares_about: ['truthful systems'],
      skepticisms: ['self-reported proof'],
      credibility_signals: ['exact-version evidence'],
      desired_impression: 'The system fails closed.',
      desired_action: 'Inspect the proof boundary.',
    },
    own_history: {
      observed_at: '2026-09-13T17:59:00.000Z',
      history_digest: HISTORY_DIGEST,
      post_count: 1,
      last_published_at: '2026-09-13T17:58:00.000Z',
      recent_pattern_signatures: [],
      learning_signal_hashes: [],
      recent_draft_fingerprints: [],
    },
    market_context: { required: false, source_class: 'not-required' },
    verified_public_claim_ids: ['runtime-boundary'],
    strategy: {
      selected_angle: 'proof boundary',
      hook_pattern: 'failure confession',
      frame_pattern: 'truth frame',
      proof_pattern: 'exact receipt',
      closing_pattern: 'builder question',
      counter_position: false,
      brag_claim_ids: ['runtime-boundary'],
      retired_patterns: [],
      improvement_experiment: 'Lead with the failure before the capability.',
    },
    ...overrides,
  };
}

const proposalInput = {
  source_repo: 'jussray/chief-ai-machine',
  source_commit_sha: SOURCE_SHA,
  platform: 'linkedin',
  story_type: 'founder-progress',
  issued_at: '2026-09-13T17:59:30.000Z',
  expires_at: '2026-09-14T17:59:30.000Z',
  draft_text: 'I tightened a runtime boundary so stale strategy cannot silently authorize the next action.',
  public_claims: [{
    claim_id: 'runtime-boundary',
    text: 'The founder-content runtime now uses the strategy-aware package at this source version.',
    truth_state: 'verified',
    public_safe: true,
    evidence_ref: EVIDENCE_REF,
    evidence_scope: 'runtime-boundary',
    temporal_class: 'historical_version',
    temporal_version: SOURCE_SHA,
  }],
  internal_evidence: {
    verified: true,
    ref: EVIDENCE_REF,
    kind: 'github-exact-head-contract',
    digest: EVIDENCE_DIGEST,
    not_for_publication: true,
    source_repo: 'jussray/chief-ai-machine',
    source_commit_sha: SOURCE_SHA,
    proves: ['runtime-boundary'],
    does_not_prove: ['production-runtime'],
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
    withheld_categories: ['private-implementation'],
  },
  current_you: {
    authenticated: true,
    intent_id: 'review-regression-intent',
    intent_version: 1,
    source: 'current_authenticated_founder',
    observed_at: '2026-09-13T17:59:00.000Z',
  },
  evaluated_at: '2026-09-13T18:00:00.000Z',
};

const visualDirection = {
  creative_mode: 'cinematic-proof',
  form: 'short-video-9x16',
  emotional_intent: ['clarity'],
  visual_hook: 'A proof signal reaches a boundary and refuses to cross without a receipt.',
  scene_concept: 'A restrained system map shows one verified signal stop before an unverified runtime edge.',
  motion_language: 'Slow approach, firm stop, quiet pull-back.',
  memory_line: 'Proof stops where truth stops.',
  human_outcome: 'Make the evidence boundary understandable without exposing implementation details.',
  proof_object: 'Exact-version evidence receipt',
  proof_truth_boundary: 'The receipt proves source behavior, not production outcome.',
  targets: ['linkedin'],
  preserves_human_agency: true,
  uses_manipulative_dark_patterns: false,
};

describe('current founder-content review regressions', () => {
  it('requires last_published_at whenever prior posts exist', () => {
    const input = strategyInput({
      own_history: {
        ...strategyInput().own_history,
        last_published_at: undefined,
      },
    });
    expect(() => buildFounderContentStrategyLease(input)).toThrow(
      /last_published_at is required when post_count is greater than zero/,
    );
  });

  it('preserves Unicode letters and numbers in strategy pattern normalization', () => {
    const lease = buildFounderContentStrategyLease(strategyInput({
      strategy: {
        ...strategyInput().strategy,
        selected_angle: '证据 边界',
        hook_pattern: '失败 开场',
        frame_pattern: 'حدود الحقيقة',
        proof_pattern: 'точное доказательство',
        closing_pattern: '邀请 构建者',
      },
    }));

    expect(lease.strategy.selected_angle).toBe('证据-边界');
    expect(lease.strategy.pattern_signature).toContain('失败-开场');
    expect(lease.strategy.pattern_signature).toContain('حدود-الحقيقة');
    expect(lease.strategy.pattern_signature).toContain('точное-доказательство');
  });

  it('deep-freezes every validated strategy sidecar after package creation', () => {
    const result = buildStrategyAwareFounderContentPackage({
      proposal_input: proposalInput,
      strategy_input: strategyInput(),
      visual_direction: visualDirection,
      use_context: {
        bound_at: '2026-09-13T18:00:00.000Z',
        current_history_digest: HISTORY_DIGEST,
      },
    });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.strategy_lease)).toBe(true);
    expect(Object.isFrozen(result.strategy_lease.audience)).toBe(true);
    expect(Object.isFrozen(result.strategy_binding)).toBe(true);
    expect(Object.isFrozen(result.strategy_binding.authority)).toBe(true);
    expect(Object.isFrozen(result.visual_direction)).toBe(true);
    expect(Object.isFrozen(result.authority)).toBe(true);

    expect(() => {
      result.strategy_binding.authority.publish_authorized = true;
    }).toThrow(TypeError);
    expect(() => {
      result.strategy_lease.audience.primary_segment = 'mutated';
    }).toThrow(TypeError);
  });
});
