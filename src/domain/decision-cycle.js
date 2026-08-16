import { sha256Hex } from './capability-plan.js';

export const DECISION_CYCLE_CONTRACT = 'juss-v10/decision-cycle@v1';

export const V10_DECISION_LENSES = Object.freeze([
  'human',
  'me',
  'futureyou',
  'truthmode',
  'confess',
  'billgates',
  'elonmusk',
  'ooda',
  'redteam',
  'lindymode',
  'data-analytics',
  'product-design',
  'deep-research',
  'steal',
]);

const DECISION_CLASSES = new Set(['reversible', 'high-consequence']);
const REALITY_KEYS = Object.freeze(['verified', 'inferred', 'unknown', 'blocked']);
const HASH = /^[0-9a-f]{64}$/i;
const SHA = /^[0-9a-f]{40}$/i;

function clean(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanList(values, maxItems = 40, maxLength = 1000) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value, maxLength)).filter(Boolean))]
    .sort()
    .slice(0, maxItems);
}

function normalizeReality(reality = {}) {
  return Object.fromEntries(
    REALITY_KEYS.map((key) => [key, cleanList(reality?.[key], 40, 1000)]),
  );
}

function normalizeMetric(metric = {}) {
  return {
    name: clean(metric?.name, 160),
    baseline: clean(metric?.baseline, 500),
    target: clean(metric?.target, 500),
    source: clean(metric?.source, 500),
  };
}

function normalizeLensReport(report = {}) {
  const confidence = Number(report?.confidence);
  return {
    lens: clean(report?.lens, 80).toLowerCase(),
    finding: clean(report?.finding, 3000),
    recommendation: clean(report?.recommendation, 2000),
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0,
    evidenceRefs: cleanList(report?.evidenceRefs, 30, 1000),
    assumptions: cleanList(report?.assumptions, 20, 1000),
    risks: cleanList(report?.risks, 20, 1000),
    blockers: cleanList(report?.blockers, 20, 1000),
    requestedEvidence: cleanList(report?.requestedEvidence, 20, 1000),
    metrics: Array.isArray(report?.metrics)
      ? report.metrics.map(normalizeMetric).filter((metric) => metric.name).slice(0, 12)
      : [],
  };
}

function normalizeLensReports(reports) {
  if (!Array.isArray(reports)) return [];
  return reports
    .map(normalizeLensReport)
    .filter((report) => report.lens)
    .sort((a, b) => a.lens.localeCompare(b.lens));
}

function decisionSeed(cycle) {
  return JSON.stringify([
    cycle.contract,
    cycle.goal,
    cycle.workspaceId,
    cycle.projectSlug,
    cycle.expectedHeadSha,
    cycle.customerOutcome,
    cycle.desiredState,
    cycle.currentState,
    cycle.bottleneck,
    cycle.decisionClass,
    REALITY_KEYS.map((key) => [key, cycle.reality[key]]),
    cycle.lensReports.map((report) => [
      report.lens,
      report.finding,
      report.recommendation,
      report.confidence,
      report.evidenceRefs,
      report.assumptions,
      report.risks,
      report.blockers,
      report.requestedEvidence,
      report.metrics.map((metric) => [metric.name, metric.baseline, metric.target, metric.source]),
    ]),
    cycle.dissent,
    cycle.candidateOptions,
    cycle.recommendation,
    cycle.authorityCeiling,
    cycle.proofRequirements,
    cycle.outcomeSignals,
    cycle.rollback,
    cycle.stopConditions,
    cycle.nextGate,
    cycle.requiresFounderApproval,
    cycle.executionAuthorized,
  ]);
}

export function decisionCycleHash(cycle) {
  return sha256Hex(decisionSeed(cycle));
}

export function validateDecisionCycle(cycle) {
  const errors = [];
  if (!cycle || typeof cycle !== 'object' || Array.isArray(cycle)) {
    return { valid: false, errors: ['Decision cycle must be an object'] };
  }

  if (cycle.contract !== DECISION_CYCLE_CONTRACT) errors.push('Unsupported decision-cycle contract');
  if (!clean(cycle.goal)) errors.push('Decision goal is required');
  if (!clean(cycle.workspaceId, 160)) errors.push('workspaceId is required');
  if (!clean(cycle.projectSlug, 160)) errors.push('projectSlug is required');
  if (cycle.expectedHeadSha && !SHA.test(clean(cycle.expectedHeadSha, 40))) {
    errors.push('expectedHeadSha must be a 40-character Git SHA when present');
  }
  if (!clean(cycle.customerOutcome)) errors.push('Customer outcome is required');
  if (!clean(cycle.desiredState)) errors.push('Desired state is required');
  if (!clean(cycle.currentState)) errors.push('Current state is required');
  if (!clean(cycle.bottleneck)) errors.push('Bottleneck is required');
  if (!DECISION_CLASSES.has(cycle.decisionClass)) errors.push('Unsupported decision class');

  const reality = normalizeReality(cycle.reality);
  if (REALITY_KEYS.every((key) => reality[key].length === 0)) {
    errors.push('Decision reality requires at least one classified fact');
  }

  const reports = normalizeLensReports(cycle.lensReports);
  const seen = new Set();
  for (const report of reports) {
    if (seen.has(report.lens)) errors.push(`Duplicate decision lens: ${report.lens}`);
    seen.add(report.lens);
    if (!V10_DECISION_LENSES.includes(report.lens)) errors.push(`Unsupported decision lens: ${report.lens}`);
    if (!report.finding) errors.push(`Lens ${report.lens || '<unknown>'} finding is required`);
    if (!report.recommendation) errors.push(`Lens ${report.lens || '<unknown>'} recommendation is required`);
  }
  for (const lens of V10_DECISION_LENSES) {
    if (!seen.has(lens)) errors.push(`Required V10 decision lens missing: ${lens}`);
  }

  if (!Array.isArray(cycle.candidateOptions) || cleanList(cycle.candidateOptions, 20, 1500).length === 0) {
    errors.push('Candidate options are required');
  }
  if (!clean(cycle.recommendation)) errors.push('Decision recommendation is required');
  if (cycle.authorityCeiling !== 'reason') errors.push('V10 decision cycle authority ceiling must remain reason');
  if (cycle.requiresFounderApproval !== true) errors.push('Founder approval must remain required');
  if (cycle.executionAuthorized !== false) errors.push('Decision cycle cannot authorize execution');
  if (!Array.isArray(cycle.proofRequirements) || cleanList(cycle.proofRequirements).length === 0) {
    errors.push('Proof requirements are required');
  }
  if (!Array.isArray(cycle.outcomeSignals) || cleanList(cycle.outcomeSignals).length === 0) {
    errors.push('Outcome signals are required');
  }
  if (!clean(cycle.rollback)) errors.push('Rollback is required');
  if (!Array.isArray(cycle.stopConditions) || cleanList(cycle.stopConditions).length === 0) {
    errors.push('Stop conditions are required');
  }
  if (!clean(cycle.nextGate)) errors.push('Next gate is required');

  if (!HASH.test(clean(cycle.decisionHash, 64))) errors.push('decisionHash must be sha256');
  else {
    const normalized = normalizeDecisionCycle(cycle, { includeHash: false });
    if (decisionCycleHash(normalized) !== cycle.decisionHash.toLowerCase()) {
      errors.push('Decision cycle hash does not match decision content');
    }
  }

  return { valid: errors.length === 0, errors };
}

function normalizeDecisionCycle(input = {}, options = {}) {
  const normalized = {
    contract: DECISION_CYCLE_CONTRACT,
    goal: clean(input.goal),
    workspaceId: clean(input.workspaceId, 160),
    projectSlug: clean(input.projectSlug, 160),
    expectedHeadSha: clean(input.expectedHeadSha, 40).toLowerCase(),
    customerOutcome: clean(input.customerOutcome),
    desiredState: clean(input.desiredState),
    currentState: clean(input.currentState),
    bottleneck: clean(input.bottleneck),
    decisionClass: clean(input.decisionClass, 40).toLowerCase(),
    reality: normalizeReality(input.reality),
    lensReports: normalizeLensReports(input.lensReports),
    dissent: cleanList(input.dissent, 30, 1500),
    candidateOptions: cleanList(input.candidateOptions, 20, 1500),
    recommendation: clean(input.recommendation),
    authorityCeiling: 'reason',
    proofRequirements: cleanList(input.proofRequirements, 30, 1000),
    outcomeSignals: cleanList(input.outcomeSignals, 30, 1000),
    rollback: clean(input.rollback),
    stopConditions: cleanList(input.stopConditions, 30, 1000),
    nextGate: clean(input.nextGate),
    requiresFounderApproval: true,
    executionAuthorized: false,
  };

  if (options.includeHash === false) return normalized;
  return { ...normalized, decisionHash: decisionCycleHash(normalized) };
}

export function createDecisionCycle(input = {}) {
  const cycle = normalizeDecisionCycle(input);
  const validation = validateDecisionCycle(cycle);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return Object.freeze(cycle);
}
