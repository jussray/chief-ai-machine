// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { createHash } from 'node:crypto';

export const CAPABILITY_PLAN_CONTRACT = 'juss-v10/capability-plan@v1';
export const CAPABILITY_PLAN_SELECTOR = 'chief-ai-machine';

export const CAPABILITY_ORIGINS = Object.freeze([
  'founder-native',
  'repo-native',
  'generated',
  'provider',
  'community',
  'vendor',
]);

export const CAPABILITY_AUTHORITY_LEVELS = Object.freeze([
  'reason',
  'draft',
  'reversible',
  'privileged',
]);

const ORIGIN_SET = new Set(CAPABILITY_ORIGINS);
const AUTHORITY_SET = new Set(CAPABILITY_AUTHORITY_LEVELS);
const AUTHORITY_RANK = new Map(CAPABILITY_AUTHORITY_LEVELS.map((value, index) => [value, index]));
const ORIGIN_AUTHORITY_CEILING = Object.freeze({
  'founder-native': 'privileged',
  'repo-native': 'privileged',
  generated: 'draft',
  provider: 'draft',
  community: 'draft',
  vendor: 'draft',
});

const FULL_SHA = /^[0-9a-f]{40}$/i;
const HASH = /^[0-9a-f]{64}$/i;

function cleanText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(values, maxItems = 30, maxLength = 500) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))]
    .sort()
    .slice(0, maxItems);
}

function normalizeCapability(capability) {
  return {
    id: cleanText(capability?.id, 160),
    version: cleanText(capability?.version, 80),
    origin: cleanText(capability?.origin, 40),
    owner: cleanText(capability?.owner, 160),
    sourceHash: cleanText(capability?.sourceHash, 64).toLowerCase(),
    authorityCeiling: cleanText(capability?.authorityCeiling, 40),
  };
}

function normalizedCapabilities(values) {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeCapability).sort((a, b) => a.id.localeCompare(b.id)).slice(0, 30);
}

function authorityAllows(requested, ceiling) {
  const requestedRank = AUTHORITY_RANK.get(requested);
  const ceilingRank = AUTHORITY_RANK.get(ceiling);
  return requestedRank !== undefined && ceilingRank !== undefined && requestedRank <= ceilingRank;
}

function capabilityPlanSeed(plan) {
  return JSON.stringify([
    plan.contract,
    plan.selectedBy,
    plan.goal,
    plan.projectSlug,
    plan.expectedHeadSha,
    plan.registryHash,
    plan.requestedAuthority,
    plan.strategicLenses,
    plan.routingReason,
    plan.capabilities.map((capability) => [
      capability.id,
      capability.version,
      capability.origin,
      capability.owner,
      capability.sourceHash,
      capability.authorityCeiling,
    ]),
    plan.proofRequirements,
    plan.outcomeSignals,
    plan.rollback,
  ]);
}

export function capabilityPlanHash(plan) {
  return createHash('sha256').update(capabilityPlanSeed(plan)).digest('hex');
}

export function validateCapabilityPlan(plan) {
  const errors = [];

  if (!plan || typeof plan !== 'object') return { valid: false, errors: ['Capability plan must be an object'] };
  if (plan.contract !== CAPABILITY_PLAN_CONTRACT) errors.push('Unsupported capability plan contract');
  if (plan.selectedBy !== CAPABILITY_PLAN_SELECTOR) errors.push('Capability selection must be owned by Chief AI Machine');
  if (!cleanText(plan.goal)) errors.push('Capability plan goal is required');
  if (!cleanText(plan.projectSlug, 160)) errors.push('Capability plan projectSlug is required');
  if (!FULL_SHA.test(cleanText(plan.expectedHeadSha, 40))) errors.push('Capability plan expectedHeadSha must be a full Git SHA');
  if (!HASH.test(cleanText(plan.registryHash, 64))) errors.push('Capability plan registryHash must be sha256');
  if (!AUTHORITY_SET.has(plan.requestedAuthority)) errors.push('Unsupported requested authority');
  if (!cleanText(plan.routingReason, 2000)) errors.push('Capability plan routing reason is required');
  if (!cleanText(plan.rollback, 2000)) errors.push('Capability plan rollback is required');
  if (!Array.isArray(plan.strategicLenses) || plan.strategicLenses.length === 0) {
    errors.push('Capability plan strategic lenses are required');
  }
  if (!Array.isArray(plan.proofRequirements) || plan.proofRequirements.length === 0) {
    errors.push('Capability plan proof requirements are required');
  }
  if (!Array.isArray(plan.outcomeSignals) || plan.outcomeSignals.length === 0) {
    errors.push('Capability plan outcome signals are required');
  }

  if (!Array.isArray(plan.capabilities) || plan.capabilities.length === 0) {
    errors.push('Capability plan requires at least one capability');
  } else if (plan.capabilities.length > 30) {
    errors.push('Capability plan exceeds the capability limit');
  } else {
    const ids = new Set();
    for (const capability of plan.capabilities) {
      if (!cleanText(capability?.id, 160)) errors.push('Capability id is required');
      if (!cleanText(capability?.version, 80)) errors.push(`Capability ${capability?.id || '<unknown>'} version is required`);
      if (!ORIGIN_SET.has(capability?.origin)) errors.push(`Capability ${capability?.id || '<unknown>'} has unsupported origin`);
      if (!cleanText(capability?.owner, 160)) errors.push(`Capability ${capability?.id || '<unknown>'} owner is required`);
      if (!HASH.test(cleanText(capability?.sourceHash, 64))) errors.push(`Capability ${capability?.id || '<unknown>'} sourceHash must be sha256`);
      if (!AUTHORITY_SET.has(capability?.authorityCeiling)) errors.push(`Capability ${capability?.id || '<unknown>'} has unsupported authority ceiling`);

      if (ids.has(capability?.id)) errors.push(`Duplicate capability id: ${capability?.id}`);
      ids.add(capability?.id);

      if (ORIGIN_SET.has(capability?.origin) && AUTHORITY_SET.has(capability?.authorityCeiling)) {
        const originCeiling = ORIGIN_AUTHORITY_CEILING[capability.origin];
        if (!authorityAllows(capability.authorityCeiling, originCeiling)) {
          errors.push(`Capability ${capability.id} authority exceeds its ${capability.origin} origin ceiling`);
        }
      }

      if (AUTHORITY_SET.has(plan.requestedAuthority) && AUTHORITY_SET.has(capability?.authorityCeiling)) {
        if (!authorityAllows(plan.requestedAuthority, capability.authorityCeiling)) {
          errors.push(`Capability ${capability.id} cannot satisfy requested authority ${plan.requestedAuthority}`);
        }
      }
    }
  }

  if (!HASH.test(cleanText(plan.planHash, 64))) {
    errors.push('Capability plan hash must be sha256');
  } else if (capabilityPlanHash(plan) !== plan.planHash.toLowerCase()) {
    errors.push('Capability plan hash does not match plan content');
  }

  return { valid: errors.length === 0, errors };
}

export function createCapabilityPlan(input) {
  const plan = {
    contract: CAPABILITY_PLAN_CONTRACT,
    selectedBy: CAPABILITY_PLAN_SELECTOR,
    goal: cleanText(input?.goal),
    projectSlug: cleanText(input?.projectSlug, 160),
    expectedHeadSha: cleanText(input?.expectedHeadSha, 40).toLowerCase(),
    registryHash: cleanText(input?.registryHash, 64).toLowerCase(),
    requestedAuthority: AUTHORITY_SET.has(input?.requestedAuthority) ? input.requestedAuthority : 'reason',
    strategicLenses: cleanStringList(input?.strategicLenses, 20, 120),
    routingReason: cleanText(input?.routingReason, 2000),
    capabilities: normalizedCapabilities(input?.capabilities),
    proofRequirements: cleanStringList(input?.proofRequirements, 30, 500),
    outcomeSignals: cleanStringList(input?.outcomeSignals, 30, 500),
    rollback: cleanText(input?.rollback, 2000),
  };

  const withHash = { ...plan, planHash: capabilityPlanHash(plan) };
  const validation = validateCapabilityPlan(withHash);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return withHash;
}
