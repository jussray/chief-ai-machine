import { describe, expect, it } from 'vitest';
import { createGoalPlan } from './goal-plan.js';
import { createPromptOSPeerIntegration, PROMPTOS_PRODUCT } from './promptos-peer.js';
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
    nextGate: 'PromptOS compiles the mission contract for the selected project',
    ...overrides,
  });
}

describe('Founder intent envelope', () => {
  it('keeps Chief AI responsible for strategy and integrates independent PromptOS', () => {
    const envelope = createFounderIntentEnvelope({
      goalPlan: readyGoal(),
      outcomeSignals: ['dashboard completion rate', 'auth recovery success'],
      decisionMetric: 'verified onboarding completion movement',
    });

    expect(envelope.contract).toBe(FOUNDER_INTENT_ENVELOPE_CONTRACT);
    expect(envelope.issuedBy).toBe('chief-ai-machine');
    expect(envelope.delegation.promptOS).toMatchObject({
      contract: PROMPTOS_MISSION_CONTRACT,
      repository: 'jussray/promptos',
      relationship: 'peer-integration',
      ownership: 'independent-product',
      portability: 'host-neutral',
    });
    expect(envelope.delegation.promptOS.integration.consumer).toBe('chief-ai-machine');
    expect(envelope.delegation.promptOS.integration.targetProject).toBe('jussray/Sekret-Bip');
    expect(envelope.strategy.desiredCapabilities).toEqual(['product-design', 'data-analytics']);
    expect(envelope.evaluation.decisionMetric).toBe('verified onboarding completion movement');
    expect(envelope.evaluation.outcomeSignals).toContain('dashboard completion rate');
  });

  it('keeps PromptOS product identity stable across different consumers', () => {
    const chief = createPromptOSPeerIntegration({ consumer: 'chief-ai-machine', targetProject: 'project-a' });
    const fcr = createPromptOSPeerIntegration({ consumer: 'founder-control-room', targetProject: 'project-b' });
    const anotherHost = createPromptOSPeerIntegration({ consumer: 'another-authorized-host', targetProject: 'project-c' });

    for (const integration of [chief, fcr, anotherHost]) {
      expect(integration).toMatchObject({
        product: PROMPTOS_PRODUCT.product,
        repository: 'jussray/promptos',
        role: 'human-ai-operating-layer',
        portability: 'host-neutral',
        relationship: 'peer-integration',
        ownership: 'independent-product',
      });
    }
    expect(new Set([chief.consumer, fcr.consumer, anotherHost.consumer]).size).toBe(3);
  });

  it('does not pretend Chief AI owns provider credentials or execution authority', () => {
    const envelope = createFounderIntentEnvelope({ goalPlan: readyGoal() });

    expect(envelope.delegation.fcr).toMatchObject({
      executionAuthority: 'unresolved-by-chief-ai',
      credentialAuthority: 'unresolved-by-chief-ai',
    });
    expect(envelope.boundaries.join('\n')).toMatch(/does not grant execution authority/i);
    expect(envelope.boundaries.join('\n')).toMatch(/independent host-neutral product/i);
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
