import { createHash } from 'node:crypto';
import { validateDecisionCycle } from './decision-cycle.js';

export const RECURSIVE_HARDENING_CONTRACT = 'juss-v10/recursive-hardening@v1';

export const RECURSIVE_ATTACK_MODES = Object.freeze([
  'evidence-falsification',
  'authority-inversion',
  'temporal-race',
  'human-outcome',
]);

export const RECURSIVE_REQUIRED_SKILLS = Object.freeze([
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
  'l99',
  'ultrathink',
  'unlearn',
  '80-20',
  'antiadvice',
  'first-principles',
  'ycombinator',
  'socrates',
]);

const HASH = /^[0-9a-f]{64}$/i;
const DISPOSITIONS = new Set(['survived', 'revised', 'blocked']);
const MODE_SET = new Set(RECURSIVE_ATTACK_MODES);
const REQUIRED_SKILL_SET = new Set(RECURSIVE_REQUIRED_SKILLS);

function clean(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanList(values, maxItems = 60, maxLength = 1000) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value, maxLength)).filter(Boolean))]
    .sort()
    .slice(0, maxItems);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function normalizeAttack(attack = {}) {
  return {
    mode: clean(attack.mode, 80).toLowerCase(),
    finding: clean(attack.finding, 3000),
    falsifier: clean(attack.falsifier, 3000),
    evidenceRefs: cleanList(attack.evidenceRefs, 30, 1000),
    skills: cleanList(attack.skills, 30, 120).map((skill) => skill.toLowerCase()),
    disposition: clean(attack.disposition, 40).toLowerCase(),
  };
}

function normalizeCycle(cycle = {}) {
  return {
    cycle: Number.isInteger(cycle.cycle) ? cycle.cycle : 0,
    inputConclusionHash: clean(cycle.inputConclusionHash, 64).toLowerCase(),
    observation: clean(cycle.observation, 3000),
    orientation: clean(cycle.orientation, 3000),
    attacks: Array.isArray(cycle.attacks)
      ? cycle.attacks.map(normalizeAttack).sort((left, right) => left.mode.localeCompare(right.mode))
      : [],
    decision: clean(cycle.decision, 40).toLowerCase(),
    outputConclusion: clean(cycle.outputConclusion, 4000),
    outputConclusionHash: clean(cycle.outputConclusionHash, 64).toLowerCase(),
  };
}

function normalizeRecursiveHardening(input = {}, options = {}) {
  const normalized = {
    contract: RECURSIVE_HARDENING_CONTRACT,
    decisionHash: clean(input.decisionHash, 64).toLowerCase(),
    initialConclusion: clean(input.initialConclusion, 4000),
    initialConclusionHash: clean(input.initialConclusionHash, 64).toLowerCase(),
    attackModes: cleanList(input.attackModes, 10, 80).map((mode) => mode.toLowerCase()),
    cycles: Array.isArray(input.cycles) ? input.cycles.map(normalizeCycle) : [],
    finalConclusion: clean(input.finalConclusion, 4000),
    finalConclusionHash: clean(input.finalConclusionHash, 64).toLowerCase(),
    finalDisposition: clean(input.finalDisposition, 40).toLowerCase(),
    skillsCovered: cleanList(input.skillsCovered, 60, 120).map((skill) => skill.toLowerCase()),
    authorityCeiling: 'reason',
    requiresFounderApproval: true,
    executionAuthorized: false,
  };
  if (options.includeHash === false) return normalized;
  return { ...normalized, hardeningHash: recursiveHardeningHash(normalized) };
}

function recursiveHardeningSeed(receipt) {
  return JSON.stringify([
    receipt.contract,
    receipt.decisionHash,
    receipt.initialConclusion,
    receipt.initialConclusionHash,
    receipt.attackModes,
    receipt.cycles.map((cycle) => [
      cycle.cycle,
      cycle.inputConclusionHash,
      cycle.observation,
      cycle.orientation,
      cycle.attacks.map((attack) => [
        attack.mode,
        attack.finding,
        attack.falsifier,
        attack.evidenceRefs,
        attack.skills,
        attack.disposition,
      ]),
      cycle.decision,
      cycle.outputConclusion,
      cycle.outputConclusionHash,
    ]),
    receipt.finalConclusion,
    receipt.finalConclusionHash,
    receipt.finalDisposition,
    receipt.skillsCovered,
    receipt.authorityCeiling,
    receipt.requiresFounderApproval,
    receipt.executionAuthorized,
  ]);
}

export function recursiveHardeningHash(receipt) {
  return sha256(recursiveHardeningSeed(receipt));
}

export function validateRecursiveHardening(baseDecision, receipt) {
  const errors = [];
  const baseValidation = validateDecisionCycle(baseDecision);
  if (!baseValidation.valid) {
    errors.push(...baseValidation.errors.map((error) => `base decision: ${error}`));
  }
  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { valid: false, authorityEligible: false, errors: ['Recursive hardening receipt must be an object'] };
  }

  const normalized = normalizeRecursiveHardening(receipt, { includeHash: false });
  if (receipt.contract !== RECURSIVE_HARDENING_CONTRACT) errors.push('Unsupported recursive hardening contract');
  if (!HASH.test(normalized.decisionHash)) errors.push('Recursive hardening decisionHash must be sha256');
  if (normalized.decisionHash !== clean(baseDecision?.decisionHash, 64).toLowerCase()) {
    errors.push('Recursive hardening decisionHash does not match base decision');
  }
  if (!normalized.initialConclusion) errors.push('Recursive hardening initial conclusion is required');
  if (normalized.initialConclusion !== clean(baseDecision?.recommendation, 4000)) {
    errors.push('Recursive hardening must attack the base decision recommendation');
  }
  if (normalized.initialConclusionHash !== sha256(normalized.initialConclusion)) {
    errors.push('Recursive hardening initial conclusion hash mismatch');
  }

  if (normalized.attackModes.length !== RECURSIVE_ATTACK_MODES.length
    || RECURSIVE_ATTACK_MODES.some((mode) => !normalized.attackModes.includes(mode))) {
    errors.push('Recursive hardening requires exactly four canonical attack modes');
  }

  if (normalized.cycles.length !== 10) errors.push('Recursive hardening requires exactly 10 OODA cycles');

  let priorHash = normalized.initialConclusionHash;
  let allCyclesSurvived = true;
  const skillsObserved = new Set();
  normalized.cycles.forEach((cycle, index) => {
    const expectedCycle = index + 1;
    if (cycle.cycle !== expectedCycle) errors.push(`Recursive hardening cycle ${expectedCycle} number mismatch`);
    if (cycle.inputConclusionHash !== priorHash) errors.push(`Recursive hardening cycle ${expectedCycle} input conclusion is stale`);
    if (!cycle.observation) errors.push(`Recursive hardening cycle ${expectedCycle} observation is required`);
    if (!cycle.orientation) errors.push(`Recursive hardening cycle ${expectedCycle} orientation is required`);
    if (cycle.attacks.length !== 4) errors.push(`Recursive hardening cycle ${expectedCycle} requires four attacks`);

    const seenModes = new Set();
    const seenFindings = new Set();
    const cycleSkills = new Set();
    for (const attack of cycle.attacks) {
      if (!MODE_SET.has(attack.mode)) errors.push(`Recursive hardening cycle ${expectedCycle} has unsupported attack mode: ${attack.mode}`);
      if (seenModes.has(attack.mode)) errors.push(`Recursive hardening cycle ${expectedCycle} repeats attack mode: ${attack.mode}`);
      seenModes.add(attack.mode);
      if (!attack.finding) errors.push(`Recursive hardening cycle ${expectedCycle} ${attack.mode} finding is required`);
      if (seenFindings.has(attack.finding)) errors.push(`Recursive hardening cycle ${expectedCycle} repeats an attack finding`);
      seenFindings.add(attack.finding);
      if (!attack.falsifier) errors.push(`Recursive hardening cycle ${expectedCycle} ${attack.mode} falsifier is required`);
      if (attack.evidenceRefs.length === 0) errors.push(`Recursive hardening cycle ${expectedCycle} ${attack.mode} evidence is required`);
      if (!DISPOSITIONS.has(attack.disposition)) errors.push(`Recursive hardening cycle ${expectedCycle} ${attack.mode} disposition is invalid`);
      if (attack.disposition !== 'survived') allCyclesSurvived = false;
      for (const skill of attack.skills) {
        cycleSkills.add(skill);
        skillsObserved.add(skill);
      }
    }
    for (const mode of RECURSIVE_ATTACK_MODES) {
      if (!seenModes.has(mode)) errors.push(`Recursive hardening cycle ${expectedCycle} missing attack mode: ${mode}`);
    }
    for (const skill of ['redteam', 'ooda']) {
      if (!cycleSkills.has(skill)) errors.push(`Recursive hardening cycle ${expectedCycle} must exercise ${skill}`);
    }

    if (!DISPOSITIONS.has(cycle.decision)) errors.push(`Recursive hardening cycle ${expectedCycle} decision is invalid`);
    if (cycle.decision !== 'survived') allCyclesSurvived = false;
    if (!cycle.outputConclusion) errors.push(`Recursive hardening cycle ${expectedCycle} output conclusion is required`);
    if (cycle.outputConclusionHash !== sha256(cycle.outputConclusion)) {
      errors.push(`Recursive hardening cycle ${expectedCycle} output conclusion hash mismatch`);
    }
    if (cycle.decision === 'survived' && cycle.outputConclusionHash !== priorHash) {
      errors.push(`Recursive hardening cycle ${expectedCycle} cannot revise a survived conclusion`);
    }
    priorHash = cycle.outputConclusionHash;
  });

  for (const skill of REQUIRED_SKILL_SET) {
    if (!skillsObserved.has(skill)) errors.push(`Recursive hardening missing required skill coverage: ${skill}`);
  }
  const normalizedSkills = [...skillsObserved].sort();
  if (JSON.stringify(normalized.skillsCovered) !== JSON.stringify(normalizedSkills)) {
    errors.push('Recursive hardening skillsCovered does not match observed attack skills');
  }

  if (normalized.finalConclusion !== (normalized.cycles.at(-1)?.outputConclusion || '')) {
    errors.push('Recursive hardening final conclusion does not match cycle 10');
  }
  if (normalized.finalConclusionHash !== sha256(normalized.finalConclusion)) {
    errors.push('Recursive hardening final conclusion hash mismatch');
  }
  if (normalized.finalConclusionHash !== priorHash) {
    errors.push('Recursive hardening final conclusion hash does not match cycle chain');
  }
  if (!DISPOSITIONS.has(normalized.finalDisposition)) errors.push('Recursive hardening final disposition is invalid');
  if (normalized.finalDisposition !== 'survived') allCyclesSurvived = false;
  if (normalized.finalDisposition === 'survived'
    && normalized.finalConclusionHash !== normalized.initialConclusionHash) {
    errors.push('Recursive hardening survived disposition requires the original conclusion to remain unchanged');
  }

  if (receipt.authorityCeiling !== 'reason') errors.push('Recursive hardening cannot exceed reason authority');
  if (receipt.requiresFounderApproval !== true) errors.push('Recursive hardening must preserve founder approval');
  if (receipt.executionAuthorized !== false) errors.push('Recursive hardening cannot authorize execution');
  if (!HASH.test(clean(receipt.hardeningHash, 64))) {
    errors.push('Recursive hardening hardeningHash must be sha256');
  } else if (recursiveHardeningHash(normalized) !== clean(receipt.hardeningHash, 64).toLowerCase()) {
    errors.push('Recursive hardening hash does not match receipt content');
  }

  const authorityEligible = errors.length === 0
    && allCyclesSurvived
    && normalized.finalConclusionHash === normalized.initialConclusionHash;

  return { valid: errors.length === 0, authorityEligible, errors };
}

export function createRecursiveHardening(baseDecision, input = {}) {
  const normalized = normalizeRecursiveHardening({
    ...input,
    decisionHash: baseDecision?.decisionHash,
    initialConclusion: baseDecision?.recommendation,
    initialConclusionHash: sha256(clean(baseDecision?.recommendation, 4000)),
  });
  const validation = validateRecursiveHardening(baseDecision, normalized);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return Object.freeze(normalized);
}
