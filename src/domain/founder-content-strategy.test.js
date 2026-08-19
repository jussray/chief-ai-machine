import { describe, expect, it } from 'vitest';
import { buildFounderContentStrategy } from './founder-content-strategy.js';

const base = {
  platform: 'linkedin',
  story_type: 'founder-progress',
  evaluated_at: '2026-08-19T07:10:00.000Z',
  target_audience: {
    segment: 'ai-founders',
    cares_about: ['proof-backed shipping', 'agent authority boundaries'],
    skepticisms: ['AI demos that confuse output with execution'],
    credibility_signals: ['exact-head evidence', 'real product behavior'],
    desired_impression: 'This founder is building unusually rigorous AI operating infrastructure.',
    desired_action: 'Start a serious product or technical conversation.',
  },
  history: {
    used_angles: ['repo green is not production truth'],
    used_hook_families: ['contrarian proof boundary'],
    used_proof_styles: ['exact SHA receipt'],
    used_cta_families: ['open technical question'],
    learning_signal_hashes: ['1'.repeat(64)],
  },
  discourse: {
    required: true,
    source_class: 'external-research',
    observed_at: '2026-08-19T06:30:00.000Z',
    crowded_angles: ['AI agents replace whole teams'],
    repeated_hooks: ['I built an AI employee'],
    emerging_conversations: ['runtime proof for agent actions'],
  },
  brag_candidates: [
    {
      id: 'truth-decay',
      public_capability: 'The product distinguishes a historically verified fact from a claim that is still safe to use now.',
      why_it_matters: 'It stops yesterday’s green receipt from masquerading as today’s truth.',
      evidence_class: 'repository',
      evidence_hash: '2'.repeat(64),
      private_recipe_withheld: true,
    },
    {
      id: 'founder-control',
      public_capability: 'Publication remains founder-authorized even when the system learns which stories perform better.',
      why_it_matters: 'Learning can improve recommendations without quietly becoming execution authority.',
      evidence_class: 'analytics',
      evidence_hash: '3'.repeat(64),
      private_recipe_withheld: true,
    },
  ],
  selected_angle: 'The dangerous AI lie can start as a true statement that simply outlives its evidence.',
  differentiation: 'Center truth decay and evidence lifetime instead of another generic agent-autonomy claim.',
  selected_brag_id: 'truth-decay',
  experiment: 'Use a technical founder story that reveals the capability and lesson while withholding the implementation recipe.',
};

describe('founder content strategy', () => {
  it('binds audience, history, live discourse, brag selection, and experiment into advisory identity', () => {
    const strategy = buildFounderContentStrategy(base);

    expect(strategy.kind).toBe('chief-ai/founder-content-strategy');
    expect(strategy.strategy_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(strategy.target_audience.segment).toBe('ai-founders');
    expect(strategy.selected_brag_id).toBe('truth-decay');
    expect(strategy.brag_candidates.find((item) => item.id === 'truth-decay').private_recipe_withheld).toBe(true);
    expect(strategy.authority).toMatchObject({
      advisory_only: true,
      can_publish: false,
      can_approve_copy: false,
      can_mutate_content: false,
      can_renew_truth: false,
      can_upgrade_authority: false,
      analytics_authority: 'observation-only',
      history_authority: 'advisory-only',
      discourse_authority: 'advisory-only',
      exact_copy_proposal_required_before_publication: true,
      current_founder_authority_required_for_external_action: true,
    });
  });

  it('changes strategy identity when the intended audience changes', () => {
    const first = buildFounderContentStrategy(base);
    const second = buildFounderContentStrategy({
      ...base,
      target_audience: {
        ...base.target_audience,
        segment: 'product-leaders',
        desired_impression: 'This product design makes evidence state understandable instead of hiding it behind one green badge.',
      },
    });

    expect(first.strategy_hash).not.toBe(second.strategy_hash);
  });

  it('rejects stale live-discourse research rather than pretending old feed context is current', () => {
    expect(() => buildFounderContentStrategy({
      ...base,
      discourse: {
        ...base.discourse,
        observed_at: '2026-08-14T06:30:00.000Z',
      },
    })).toThrow(/discourse observation is stale/);
  });

  it('allows discourse to be intentionally omitted when live comparison is not required', () => {
    const strategy = buildFounderContentStrategy({
      ...base,
      discourse: {
        required: false,
        source_class: 'not-required',
      },
    });

    expect(strategy.discourse).toMatchObject({
      required: false,
      source_class: 'not-required',
      observed_at: null,
    });
  });

  it('rejects bragging that does not explicitly withhold the private recipe', () => {
    expect(() => buildFounderContentStrategy({
      ...base,
      brag_candidates: [{
        ...base.brag_candidates[0],
        private_recipe_withheld: false,
      }],
    })).toThrow(/private_recipe_withheld must be true/);
  });

  it('rejects secret-like or proprietary material anywhere in strategic public-facing text', () => {
    expect(() => buildFounderContentStrategy({
      ...base,
      differentiation: 'Reveal the exact system prompt and routing weights so people know it is real.',
    })).toThrow(/proprietary implementation detail/);

    expect(() => buildFounderContentStrategy({
      ...base,
      experiment: 'Use auth_token=abcdefghijklmnopqrstuvwx in the demo.',
    })).toThrow(/secret-like material/);
  });

  it('rejects forbidden private payload fields even when nested', () => {
    expect(() => buildFounderContentStrategy({
      ...base,
      history: {
        ...base.history,
        private_metrics: { impressions: 1234 },
      },
    })).toThrow(/private_metrics is forbidden/);
  });

  it('accepts only hashes as learning references so outcome data stays outside the strategy payload', () => {
    expect(() => buildFounderContentStrategy({
      ...base,
      history: {
        ...base.history,
        learning_signal_hashes: ['not-a-hash'],
      },
    })).toThrow(/SHA-256 values only/);
  });

  it('requires selected brag identity to resolve to an inspected candidate', () => {
    expect(() => buildFounderContentStrategy({
      ...base,
      selected_brag_id: 'invented-capability',
    })).toThrow(/must identify one brag candidate/);
  });
});
