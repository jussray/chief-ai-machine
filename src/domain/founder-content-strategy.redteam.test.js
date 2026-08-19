import { describe, expect, it } from 'vitest';
import { buildFounderContentStrategy } from './founder-content-strategy.js';

const input = {
  platform: 'linkedin',
  story_type: 'technical-story',
  evaluated_at: '2026-08-19T07:20:00.000Z',
  target_audience: {
    segment: 'technical-founders',
    cares_about: ['truthful agent systems'],
    skepticisms: ['self-reported proof'],
    credibility_signals: ['bounded authority'],
    desired_impression: 'The system separates recommendation from authority.',
    desired_action: 'Inspect the public capability rather than the private implementation.',
  },
  history: {
    used_angles: ['authority must be explicit'],
    used_hook_families: ['failure-first'],
    used_proof_styles: ['sanitized receipt'],
    used_cta_families: ['technical discussion'],
    learning_signal_hashes: ['4'.repeat(64)],
  },
  discourse: {
    required: true,
    source_class: 'external-research',
    observed_at: '2026-08-19T07:00:00.000Z',
    crowded_angles: ['agent autonomy'],
    repeated_hooks: ['my agent runs everything'],
    emerging_conversations: ['proof-bound agents'],
  },
  brag_candidates: [{
    id: 'bounded-learning',
    public_capability: 'Outcome learning can improve the next recommendation without becoming publication authority.',
    why_it_matters: 'The feedback loop compounds while founder control stays intact.',
    evidence_class: 'analytics',
    evidence_hash: '5'.repeat(64),
    private_recipe_withheld: true,
  }],
  selected_angle: 'The feedback loop should get smarter without getting more powerful.',
  differentiation: 'Separate learning quality from action authority.',
  selected_brag_id: 'bounded-learning',
  experiment: 'Target technical founders with one capability-level brag and no implementation disclosure.',
};

describe('founder content strategy red-team', () => {
  it('sauce-guards historical writing patterns so memory cannot reintroduce private mechanics', () => {
    expect(() => buildFounderContentStrategy({
      ...input,
      history: {
        ...input.history,
        used_angles: ['The exact private prompt and routing weights were the old angle.'],
      },
    })).toThrow(/history\.used_angles contains proprietary implementation detail/);
  });

  it('labels strategy evidence and discourse as submitted advisory references, not authenticated proof', () => {
    const strategy = buildFounderContentStrategy(input);

    expect(strategy.discourse.source_trust).toBe('submitted-unverified');
    expect(strategy.brag_candidates[0]).toMatchObject({
      evidence_trust: 'submitted-unverified',
      evidence_hash_role: 'advisory-reference-only',
    });
    expect(strategy.authority.strategy_evidence_is_not_claim_proof).toBe(true);
    expect(strategy.authority.can_publish).toBe(false);
    expect(strategy.authority.can_renew_truth).toBe(false);
  });
});
