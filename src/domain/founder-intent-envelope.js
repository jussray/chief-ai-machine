import { validateGoalPlan } from './goal-plan.js';

export const FOUNDER_INTENT_ENVELOPE_CONTRACT = 'chief-ai/founder-intent-envelope@v1';
export const PROMPTOS_MISSION_CONTRACT = 'founder-os-mission-v1';

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function list(values, maxItems = 30, maxLength = 500) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

/**
 * Chief AI cognition handoff for Founder OS.
 *
 * This envelope expresses founder intent, strategy, and success evaluation.
 * It deliberately does NOT compile a PromptOS protocol, resolve credentials,
 * grant authority, or execute provider actions. PromptOS and FCR own those
 * later stages of the Founder OS pipeline.
 */
export function createFounderIntentEnvelope(input = {}) {
  const goalPlan = input.goalPlan;
  const validation = validateGoalPlan(goalPlan);
  if (!validation.valid) {
    throw new Error(`Founder intent requires a ready goal plan: ${validation.errors.join('; ')}`);
  }

  const outcomeSignals = list(input.outcomeSignals, 20, 300);
  const decisionMetric = clean(input.decisionMetric, 500)
    || 'verified goal-state movement, not task-count completed';
  const projectHint = clean(input.projectHint, 160) || clean(goalPlan.project, 160);

  return Object.freeze({
    contract: FOUNDER_INTENT_ENVELOPE_CONTRACT,
    issuedBy: 'chief-ai-machine',
    founderIntent: Object.freeze({
      goal: clean(goalPlan.goal),
      projectHint,
      priority: goalPlan.priority,
      definitionOfDone: clean(goalPlan.definitionOfDone),
      constraints: Object.freeze(list(goalPlan.constraints, 30, 500)),
    }),
    strategy: Object.freeze({
      lenses: Object.freeze(list(goalPlan.strategicLenses, 20, 120)),
      desiredCapabilities: Object.freeze(list(goalPlan.capabilities, 30, 160)),
      evidenceAvailable: Object.freeze(list(goalPlan.evidence, 30, 500)),
      proofIntent: Object.freeze(list(goalPlan.proofRequirements, 30, 500)),
      rollbackIntent: clean(goalPlan.rollback),
      nextGateIntent: clean(goalPlan.nextGate),
    }),
    delegation: Object.freeze({
      promptOS: Object.freeze({
        contract: PROMPTOS_MISSION_CONTRACT,
        responsibility: 'compile operating protocols, acceptance criteria, proof requirements, metrics, and stop conditions',
      }),
      fcr: Object.freeze({
        responsibility: 'resolve project-scoped authority, execute through provider adapters, verify, receipt, and rollback',
        executionAuthority: 'unresolved-by-chief-ai',
        credentialAuthority: 'unresolved-by-chief-ai',
      }),
    }),
    evaluation: Object.freeze({
      decisionMetric,
      outcomeSignals: Object.freeze(outcomeSignals),
      successCriteria: Object.freeze([
        clean(goalPlan.definitionOfDone),
        ...list(goalPlan.proofRequirements, 30, 500),
      ]),
      reevaluateWhen: Object.freeze([
        'new verified evidence materially changes reality',
        'the mission becomes blocked by authority or provider state',
        'proof contradicts the current plan',
        'the requested goal is verified complete',
      ]),
    }),
    boundaries: Object.freeze([
      'Chief AI may recommend desired capability but does not grant execution authority.',
      'PromptOS compilation does not grant provider or production authority.',
      'FCR must resolve live project authority before mutation.',
      'The system may exercise granted authority but may never expand its own authority.',
      'Success is evaluated from verified goal-state movement, not action count or fluent output.',
    ]),
    createdAt: new Date().toISOString(),
  });
}
