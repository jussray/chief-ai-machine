// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

const PRIORITIES = new Set(['now', 'next', 'later']);
const LIST_FIELDS = Object.freeze([
  ['evidence', 'Evidence'],
  ['constraints', 'Constraints'],
  ['strategicLenses', 'Strategic lenses'],
  ['capabilities', 'Capabilities'],
  ['proofRequirements', 'Proof requirements'],
]);

function clean(value, max = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function list(values, maxItems = 20, maxLength = 300) {
  const source = typeof values === 'string'
    ? values.split(/\n|,/)
    : Array.isArray(values) ? values : [];
  return [...new Set(source.map((value) => clean(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function isTextList(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && Boolean(clean(item)));
}

export function createGoalPlan(input = {}) {
  const goal = clean(input.goal);
  if (!goal) throw new Error('Goal is required');

  const plan = {
    goal,
    project: clean(input.project, 160) || 'general',
    priority: PRIORITIES.has(input.priority) ? input.priority : 'now',
    definitionOfDone: clean(input.definitionOfDone),
    evidence: list(input.evidence, 30, 500),
    constraints: list(input.constraints, 30, 500),
    strategicLenses: list(input.strategicLenses, 20, 120),
    capabilities: list(input.capabilities, 30, 160),
    proofRequirements: list(input.proofRequirements, 30, 500),
    rollback: clean(input.rollback),
    nextGate: clean(input.nextGate),
    createdAt: clean(input.createdAt, 40) || new Date().toISOString(),
  };

  return plan;
}

export function normalizeGoalPlan(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  try {
    return createGoalPlan(input);
  } catch {
    return null;
  }
}

export function validateGoalPlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return { valid: false, errors: ['Goal plan must be an object'] };
  }
  if (!clean(plan.goal)) errors.push('Goal is required');
  if (!clean(plan.project, 160)) errors.push('Project is required');
  if (!PRIORITIES.has(plan.priority)) errors.push('Priority must be now, next, or later');
  if (!clean(plan.definitionOfDone)) errors.push('Definition of done is required');

  for (const [field, label] of LIST_FIELDS) {
    if (!Array.isArray(plan[field])) errors.push(`${label} must be an array`);
    else if (!isTextList(plan[field]) && plan[field].length > 0) errors.push(`${label} must contain text items`);
  }

  if (Array.isArray(plan.proofRequirements) && plan.proofRequirements.length === 0) {
    errors.push('At least one proof requirement is required');
  }
  if (!clean(plan.rollback)) errors.push('Rollback is required');
  if (!clean(plan.nextGate)) errors.push('Next gate is required');
  return { valid: errors.length === 0, errors };
}

export function summarizeGoalPlan(plan) {
  const validated = validateGoalPlan(plan);
  return {
    status: validated.valid ? 'ready' : 'draft',
    goal: clean(plan?.goal),
    project: clean(plan?.project, 160),
    priority: PRIORITIES.has(plan?.priority) ? plan.priority : 'now',
    capabilityCount: Array.isArray(plan?.capabilities) ? plan.capabilities.length : 0,
    proofCount: Array.isArray(plan?.proofRequirements) ? plan.proofRequirements.length : 0,
    nextGate: clean(plan?.nextGate),
    errors: validated.errors,
  };
}
