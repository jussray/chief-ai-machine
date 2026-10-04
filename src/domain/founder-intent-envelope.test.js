import { describe, expect, it } from 'vitest';
import { createGoalPlan } from './goal-plan.js';
import {
  FOUNDER_INTENT_ENVELOPE_CONTRACT,
  PROMPTOS_MISSION_CONTRACT,
  createFounderIntentEnvelope,
} from './founder-intent-envelope.js';

function readyGoal(overrides = {}) {
  return createGoalPlan({
    goal: 'Finish the highest-impact onboarding gap',
    project: 'jussray/Sekret-Bip',
    definitionOfDone: 'A user reaches the dashboard through the verified production-intent flow',
    evidence: ['current main inspected'],
    constraints: ['preserve auth behavior'],
    strategicLenses: ['futureyou', 'redteam', 'ooda'],
    capabilities: ['product-design', 'data-analytics'],
    proofRequirements: ['Playwright real path passes', 'completion metric has a comparable readout'],
    rollback: 'Revert the focused integration',
    nextGate: 'PromptOS compiles the mission contract for FCR',
    ...overrides,
  });
}

describe('Founder intent envelope', () => {
  it('keeps Chief AI responsible for strategy and delegates compilation to PromptOS', () => {
    const envelope = createFounderIntentEnvelope({
      goalPlan: readyGoal(),
      outcomeSignals: ['dashboard completion rate', 'auth recovery success'],
      decisionMetric: 'verified onboarding completion movement',
    });

    expect(envelope.contract).toBe(FOUNDER_INTENT_ENVELOPE_CONTRACT);
    expect(envelope.issuedBy).toBe('chief-ai-machine');
    expect(envelope.delegation.promptOS.contract).toBe(PROMPTOS_MISSION_CONTRACT);
    expect(envelope.strategy.desiredCapabilities).toEqual(['product-design', 'data-analytics']);
    expect(envelope.evaluation.decisionMetric).toBe('verified onboarding completion movement');
    expect(envelope.evaluation.outcomeSignals).toContain('dashboard completion rate');
  });

  it('does not pretend Chief AI owns provider credentials or execution authority', () => {
    const envelope = createFounderIntentEnvelope({ goalPlan: readyGoal() });

    expect(envelope.delegation.fcr).toMatchObject({
      executionAuthority: 'unresolved-by-chief-ai',
      credentialAuthority: 'unresolved-by-chief-ai',
    });
    expect(envelope.boundaries.join('\n')).toMatch(/does not grant execution authority/i);
    expect(envelope.boundaries.join('\n')).toMatch(/never expand its own authority/i);
    expect(JSON.stringify(envelope)).not.toContain('apiToken');
    expect(JSON.stringify(envelope)).not.toContain('secretRef');
  });

  it('uses verified goal-state movement instead of task count as the default decision metric', () => {
    const envelope = createFounderIntentEnvelope({ goalPlan: readyGoal() });

    expect(envelope.evaluation.decisionMetric).toBe('verified goal-state movement, not task-count completed');
    expect(envelope.evaluation.successCriteria).toEqual(expect.arrayContaining([
      'A user reaches the dashboard through the verified production-intent flow',
      'Playwright real path passes',
    ]));
  });

  it('refuses to delegate an underspecified goal plan', () => {
    const draft = createGoalPlan({ goal: 'Fix launch', project: 'jussray/Sekret-Bip' });
    expect(() => createFounderIntentEnvelope({ goalPlan: draft })).toThrow(/requires a ready goal plan/i);
  });
});
