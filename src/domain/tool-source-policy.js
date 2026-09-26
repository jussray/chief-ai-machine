// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const TOOL_SOURCE_POLICY_CONTRACT = 'chief-ai/tool-source-policy@v1';

export const TOOL_MAINTENANCE_STATES = Object.freeze([
  'active',
  'maintenance',
  'archived',
  'sunset',
  'unknown',
]);

export const TOOL_LICENSE_CLASSES = Object.freeze([
  'open-source',
  'source-available',
  'proprietary',
  'unknown',
]);

export const TOOL_SELECTION_PURPOSES = Object.freeze([
  'new-dependency',
  'migration-salvage',
]);

const MAINTENANCE_SET = new Set(TOOL_MAINTENANCE_STATES);
const LICENSE_SET = new Set(TOOL_LICENSE_CLASSES);
const PURPOSE_SET = new Set(TOOL_SELECTION_PURPOSES);
const DECISION_RANK = new Map([
  ['prefer', 0],
  ['conditional', 1],
  ['salvage-only', 2],
  ['avoid-new-dependency', 3],
]);

function text(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeCandidate(input = {}) {
  const maintenanceState = MAINTENANCE_SET.has(input.maintenanceState)
    ? input.maintenanceState
    : 'unknown';
  const licenseClass = LICENSE_SET.has(input.licenseClass)
    ? input.licenseClass
    : 'unknown';

  return {
    id: text(input.id, 160),
    maintenanceState,
    licenseClass,
    selfHostable: input.selfHostable === true,
    requiresPaidService: input.requiresPaidService === true,
    lastVerifiedAt: text(input.lastVerifiedAt, 80),
    sourceRef: text(input.sourceRef, 500),
  };
}

function freshness(lastVerifiedAt, now, maxAgeDays) {
  if (!lastVerifiedAt) return 'unknown';
  const verifiedAt = Date.parse(lastVerifiedAt);
  if (Number.isNaN(verifiedAt)) return 'unknown';
  const ageMs = now.getTime() - verifiedAt;
  if (ageMs < 0) return 'unknown';
  return ageMs <= maxAgeDays * 86_400_000 ? 'fresh' : 'stale';
}

function scoreCandidate(candidate, evidenceFreshness) {
  let score = 0;
  if (candidate.maintenanceState === 'active') score += 40;
  else if (candidate.maintenanceState === 'maintenance') score += 25;
  else if (candidate.maintenanceState === 'unknown') score -= 10;
  else score -= 500;

  if (candidate.licenseClass === 'open-source') score += 35;
  else if (candidate.licenseClass === 'source-available') score += 10;
  else if (candidate.licenseClass === 'proprietary') score -= 25;
  else score -= 10;

  if (candidate.selfHostable) score += 25;
  else score -= 10;

  if (candidate.requiresPaidService) score -= 30;
  else score += 20;

  if (evidenceFreshness === 'fresh') score += 10;
  else if (evidenceFreshness === 'stale') score -= 15;
  else score -= 5;

  return score;
}

export function evaluateToolCandidate(input = {}, options = {}) {
  const candidate = normalizeCandidate(input);
  if (!candidate.id) throw new Error('Tool candidate id is required');

  const purpose = PURPOSE_SET.has(options.purpose) ? options.purpose : 'new-dependency';
  const now = options.now instanceof Date ? options.now : new Date();
  const maxAgeDays = Number.isFinite(options.maxAgeDays) && options.maxAgeDays > 0
    ? options.maxAgeDays
    : 90;
  const evidenceFreshness = freshness(candidate.lastVerifiedAt, now, maxAgeDays);
  const lifecycleUnsafe = candidate.maintenanceState === 'archived' || candidate.maintenanceState === 'sunset';

  if (lifecycleUnsafe) {
    return Object.freeze({
      contract: TOOL_SOURCE_POLICY_CONTRACT,
      ...candidate,
      purpose,
      evidenceFreshness,
      score: scoreCandidate(candidate, evidenceFreshness),
      decision: purpose === 'migration-salvage' ? 'salvage-only' : 'avoid-new-dependency',
      reasons: Object.freeze([
        `maintenance:${candidate.maintenanceState}`,
        purpose === 'migration-salvage'
          ? 'bounded-salvage-allowed-without-new-runtime-reliance'
          : 'new-runtime-reliance-blocked',
      ]),
    });
  }

  const freeSelfHosted = candidate.licenseClass === 'open-source'
    && candidate.selfHostable
    && !candidate.requiresPaidService;
  const maintained = candidate.maintenanceState === 'active' || candidate.maintenanceState === 'maintenance';
  const evidenceUsable = evidenceFreshness === 'fresh';
  const decision = maintained && freeSelfHosted && evidenceUsable ? 'prefer' : 'conditional';
  const reasons = [];

  if (!maintained) reasons.push(`maintenance:${candidate.maintenanceState}`);
  if (candidate.licenseClass !== 'open-source') reasons.push(`license:${candidate.licenseClass}`);
  if (!candidate.selfHostable) reasons.push('not-self-hostable');
  if (candidate.requiresPaidService) reasons.push('recurring-paid-service-required');
  if (!evidenceUsable) reasons.push(`evidence:${evidenceFreshness}`);
  if (reasons.length === 0) reasons.push('maintained-open-source-self-hosted-free-path');

  return Object.freeze({
    contract: TOOL_SOURCE_POLICY_CONTRACT,
    ...candidate,
    purpose,
    evidenceFreshness,
    score: scoreCandidate(candidate, evidenceFreshness),
    decision,
    reasons: Object.freeze(reasons.sort()),
  });
}

export function rankToolCandidates(candidates, options = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('At least one tool candidate is required');
  }

  return candidates
    .map((candidate) => evaluateToolCandidate(candidate, options))
    .sort((left, right) => {
      const decisionDelta = (DECISION_RANK.get(left.decision) ?? 99) - (DECISION_RANK.get(right.decision) ?? 99);
      if (decisionDelta !== 0) return decisionDelta;
      if (right.score !== left.score) return right.score - left.score;
      return left.id.localeCompare(right.id);
    });
}
