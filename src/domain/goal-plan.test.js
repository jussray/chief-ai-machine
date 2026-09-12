import { describe, expect, it } from 'vitest';
import { createGoalPlan, normalizeGoalPlan, summarizeGoalPlan, validateGoalPlan } from './goal-plan.js';

describe('goal planning contract', () => {
  it('requires proof, rollback, and a next gate before a goal is ready', () => {
    const plan = createGoalPlan({
      goal: 'Ship the smallest verified auth fix',
      project: 'Sekret-Bip',
      definitionOfDone: 'Signup reaches onboarding on the real path',
      capabilities: ['repo-audit-first', 'goalfix-v1'],
      proofRequirements: ['focused tests green', 'Playwright signup flow green'],
      rollback: 'Revert the focused commit',
      nextGate: 'Founder approves merge',
    });

    expect(validateGoalPlan(plan)).toEqual({ valid: true, errors: [] });
    expect(summarizeGoalPlan(plan)).toMatchObject({
      status: 'ready',
      project: 'Sekret-Bip',
      capabilityCount: 2,
      proofCount: 2,
      nextGate: 'Founder approves merge',
    });
  });

  it('keeps an underspecified founder goal in draft state', () => {
    const plan = createGoalPlan({ goal: 'Fix launch', project: 'chief-ai-machine' });
    const result = validateGoalPlan(plan);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Definition of done is required');
    expect(result.errors).toContain('At least one proof requirement is required');
    expect(result.errors).toContain('Rollback is required');
    expect(result.errors).toContain('Next gate is required');
  });

  it('rejects raw malformed list shapes instead of calling them ready', () => {
    const raw = {
      goal: 'Ship safely',
      project: 'chief-ai-machine',
      priority: 'now',
      definitionOfDone: 'Rendered flow passes',
      evidence: [],
      constraints: 'no bypass',
      strategicLenses: [],
      capabilities: [],
      proofRequirements: ['Playwright green'],
      rollback: 'Revert the focused commit',
      nextGate: 'Review exact head',
    };

    const result = validateGoalPlan(raw);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Constraints must be an array');
    expect(summarizeGoalPlan(raw).status).toBe('draft');
  });

  it('normalizes portable string lists before readiness and continuation', () => {
    const plan = normalizeGoalPlan({
      goal: 'Ship safely',
      project: 'chief-ai-machine',
      priority: 'now',
      definitionOfDone: 'Rendered flow passes',
      evidence: 'exact head observed, source tests green',
      constraints: 'minimal edits\nno bypass',
      strategicLenses: 'ooda, redteam',
      capabilities: 'repo-audit-first',
      proofRequirements: 'unit tests green\nPlaywright green',
      rollback: 'Revert the focused commit',
      nextGate: 'Review exact head',
      createdAt: '2026-09-05T12:00:00.000Z',
    });

    expect(plan).not.toBeNull();
    expect(plan.constraints).toEqual(['minimal edits', 'no bypass']);
    expect(plan.proofRequirements).toEqual(['unit tests green', 'Playwright green']);
    expect(plan.strategicLenses).toEqual(['ooda', 'redteam']);
    expect(plan.createdAt).toBe('2026-09-05T12:00:00.000Z');
    expect(validateGoalPlan(plan)).toEqual({ valid: true, errors: [] });
  });

  it('drops non-object or goal-less portable entries', () => {
    expect(normalizeGoalPlan(null)).toBeNull();
    expect(normalizeGoalPlan([])).toBeNull();
    expect(normalizeGoalPlan({ project: 'chief-ai-machine' })).toBeNull();
  });
});
