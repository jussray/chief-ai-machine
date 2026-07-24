import { describe, expect, it } from 'vitest';
import {
  assessExecutiveBrief,
  createExecutiveBrief,
  validateExecutiveBrief,
} from './executive-brief.js';

const NOW = new Date('2026-07-23T20:00:00.000Z');

const BASE_INPUT = {
  decision: 'Proceed.',
  rationale: 'Evidence supports it.',
  reality: [{ state: 'verified', statement: 'A test passed.' }],
  nextGate: 'Founder review.',
};

describe('executive intelligence briefs', () => {
  it('creates a founder-ready brief with classified reality and dissent', () => {
    const brief = createExecutiveBrief({
      workspaceId: 'juss',
      projectId: 'chief-ai-machine',
      decision: 'Add an executive intelligence contract before provider execution.',
      reality: [
        {
          state: 'verified',
          statement: 'Chief AI currently stores provider-neutral intelligence assets.',
          sourceRefs: ['docs/ARCHITECTURE.md'],
        },
        {
          state: 'inferred',
          statement: 'A structured executive brief can reuse the existing portable-domain approach.',
        },
      ],
      rationale: 'This adds the coordination layer without granting execution authority.',
      dissent: [
        {
          role: 'Operations Chief',
          position: 'Keep the first version domain-only.',
          reason: 'The current browser prototype has no verified private backend.',
        },
      ],
      confidence: 91,
      risks: ['The contract is not yet wired into the user interface.'],
      nextGate: 'Review the contract and verify the exact PR head.',
      status: 'reviewed',
      source: 'founder-approved architecture discussion',
    }, NOW);

    expect(brief.id).toContain('add-an-executive-intelligence-contract');
    expect(brief.reality[0].state).toBe('verified');
    expect(brief.dissent[0].role).toBe('Operations Chief');
    expect(validateExecutiveBrief(brief)).toEqual({ valid: true, errors: [] });
    expect(assessExecutiveBrief(brief)).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('requires the decision, rationale, reality evidence, confidence, and next gate', () => {
    expect(() => createExecutiveBrief({}, NOW)).toThrow('Executive brief decision is required');

    expect(() => createExecutiveBrief({
      ...BASE_INPUT,
      confidence: 101,
    }, NOW)).toThrow('Executive brief confidence must be an integer from 0 to 100');
  });

  it.each(['91', '', null, true])('rejects coerced confidence value %j', (confidence) => {
    expect(() => createExecutiveBrief({
      ...BASE_INPUT,
      confidence,
    }, NOW)).toThrow('Executive brief confidence must be an integer from 0 to 100');
  });

  it('does not allow reviewed or approved briefs without verified reality', () => {
    const brief = createExecutiveBrief({
      decision: 'Wait for proof.',
      reality: [{ state: 'unknown', statement: 'Deployment status is unavailable.' }],
      rationale: 'The system cannot authorize release from an unknown state.',
      confidence: 40,
      risks: ['The release may be delayed.'],
      nextGate: 'Retrieve deployment evidence.',
      status: 'reviewed',
    }, NOW);

    expect(validateExecutiveBrief(brief)).toEqual({
      valid: false,
      errors: ['Reviewed or approved briefs require at least one verified reality item'],
    });
  });

  it('warns when confidence outruns evidence or accountability', () => {
    const brief = createExecutiveBrief({
      decision: 'Proceed with caution.',
      reality: [
        {
          state: 'verified',
          statement: 'The repository diff is focused.',
        },
        {
          state: 'blocked',
          statement: 'Hosted verification has not executed.',
        },
      ],
      rationale: 'The code shape is sound, but external proof remains blocked.',
      confidence: 88,
      nextGate: 'Run exact-head verification.',
    }, NOW);

    expect(assessExecutiveBrief(brief)).toEqual({
      valid: true,
      errors: [],
      warnings: [
        'One or more verified reality items have no source reference',
        'No dissent or alternative position is recorded',
        'No residual risk is recorded',
        'High confidence is paired with unknown or blocked reality items',
      ],
    });
  });
});
