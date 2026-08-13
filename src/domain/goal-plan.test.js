import { describe, expect, it } from 'vitest';
import { createGoalPlan, summarizeGoalPlan, validateGoalPlan } from './goal-plan.js';

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
});
