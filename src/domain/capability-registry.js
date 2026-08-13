// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import {
  CAPABILITY_AUTHORITY_LEVELS,
  CAPABILITY_ORIGINS,
  createCapabilityPlan,
  sha256Hex,
  validateCapabilityPlan,
} from './capability-plan.js';
import { validateGoalPlan } from './goal-plan.js';

export const CAPABILITY_REGISTRY_CONTRACT = 'juss-v10/capability-registry@v1';
export const EXECUTION_HANDOFF_CONTRACT = 'juss-v10/execution-handoff@v1';

const ORIGIN_SET = new Set(CAPABILITY_ORIGINS);
const AUTHORITY_SET = new Set(CAPABILITY_AUTHORITY_LEVELS);
const HASH = /^[0-9a-f]{64}$/i;

function clean(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanList(values, maxItems = 30, maxLength = 500) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value, maxLength)).filter(Boolean))]
    .sort()
    .slice(0, maxItems);
}

function normalizeCapability(capability) {
  return {
    id: clean(capability?.id, 160),
    version: clean(capability?.version, 80),
    origin: clean(capability?.origin, 40),
    owner: clean(capability?.owner, 160),
    sourceHash: clean(capability?.sourceHash, 64).toLowerCase(),
    authorityCeiling: clean(capability?.authorityCeiling, 40),
  };
}

function normalizeCapabilities(capabilities) {
  if (!Array.isArray(capabilities)) return [];
  return capabilities
    .map(normalizeCapability)
    .sort((a, b) => a.id.localeCompare(b.id))
    .slice(0, 100);
}

function registrySeed(snapshot) {
  return JSON.stringify([
    snapshot.contract,
    snapshot.registryId,
    snapshot.version,
    snapshot.approvedBy,
    snapshot.capabilities.map((capability) => [
      capability.id,
      capability.version,
      capability.origin,
      capability.owner,
      capability.sourceHash,
      capability.authorityCeiling,
    ]),
  ]);
}

export function capabilityRegistryHash(snapshot) {
  return sha256Hex(registrySeed(snapshot));
}

export function createCapabilityRegistry(input = {}) {
  const registry = {
    contract: CAPABILITY_REGISTRY_CONTRACT,
    registryId: clean(input.registryId, 160),
    version: clean(input.version, 80),
    approvedBy: clean(input.approvedBy, 160),
    capabilities: normalizeCapabilities(input.capabilities),
  };

  const withHash = { ...registry, registryHash: capabilityRegistryHash(registry) };
  const validation = validateCapabilityRegistry(withHash);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return withHash;
}

export function validateCapabilityRegistry(snapshot) {
  const errors = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return { valid: false, errors: ['Capability registry must be an object'] };
  }

  if (snapshot.contract !== CAPABILITY_REGISTRY_CONTRACT) errors.push('Unsupported capability registry contract');
  if (!clean(snapshot.registryId, 160)) errors.push('Capability registry id is required');
  if (!clean(snapshot.version, 80)) errors.push('Capability registry version is required');
  if (!clean(snapshot.approvedBy, 160)) errors.push('Capability registry approver is required');

  if (!Array.isArray(snapshot.capabilities) || snapshot.capabilities.length === 0) {
    errors.push('Capability registry requires at least one capability');
  } else if (snapshot.capabilities.length > 100) {
    errors.push('Capability registry exceeds the capability limit');
  } else {
    const ids = new Set();
    for (const capability of snapshot.capabilities) {
      const normalized = normalizeCapability(capability);
      if (!normalized.id) errors.push('Capability id is required');
      if (!normalized.version) errors.push(`Capability ${normalized.id || '<unknown>'} version is required`);
      if (!ORIGIN_SET.has(normalized.origin)) errors.push(`Capability ${normalized.id || '<unknown>'} has unsupported origin`);
      if (!normalized.owner) errors.push(`Capability ${normalized.id || '<unknown>'} owner is required`);
      if (!HASH.test(normalized.sourceHash)) errors.push(`Capability ${normalized.id || '<unknown>'} sourceHash must be sha256`);
      if (!AUTHORITY_SET.has(normalized.authorityCeiling)) errors.push(`Capability ${normalized.id || '<unknown>'} has unsupported authority ceiling`);
      if (ids.has(normalized.id)) errors.push(`Duplicate capability id: ${normalized.id}`);
      ids.add(normalized.id);
    }
  }

  if (!HASH.test(clean(snapshot.registryHash, 64))) errors.push('Capability registry hash must be sha256');
  else {
    const normalized = {
      contract: snapshot.contract,
      registryId: clean(snapshot.registryId, 160),
      version: clean(snapshot.version, 80),
      approvedBy: clean(snapshot.approvedBy, 160),
      capabilities: normalizeCapabilities(snapshot.capabilities),
    };
    if (capabilityRegistryHash(normalized) !== snapshot.registryHash.toLowerCase()) {
      errors.push('Capability registry hash does not match registry content');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function resolveCapabilities(snapshot, requestedIds) {
  const validation = validateCapabilityRegistry(snapshot);
  if (!validation.valid) throw new Error(validation.errors.join('; '));

  const requested = cleanList(requestedIds, 30, 160);
  if (requested.length === 0) throw new Error('Founder goal must request at least one capability');

  const registry = new Map(normalizeCapabilities(snapshot.capabilities).map((capability) => [capability.id, capability]));
  const missing = requested.filter((id) => !registry.has(id));
  if (missing.length) throw new Error(`Untrusted or unknown capabilities: ${missing.join(', ')}`);

  return requested.map((id) => registry.get(id));
}

export function createGoalCapabilityPlan(input) {
  const goalPlan = input?.goalPlan;
  const registrySnapshot = input?.registrySnapshot;
  const expectedHeadSha = input?.expectedHeadSha;
  const requestedAuthority = input?.requestedAuthority || 'reason';

  const goalValidation = validateGoalPlan(goalPlan);
  if (!goalValidation.valid) throw new Error(`Founder goal is not ready: ${goalValidation.errors.join('; ')}`);

  const capabilities = resolveCapabilities(registrySnapshot, goalPlan.capabilities);
  const nextGate = clean(goalPlan.nextGate, 500);
  const routingReason = `Founder goal resolved against trusted registry ${registrySnapshot.registryId}@${registrySnapshot.version}. Next gate: ${nextGate}`;

  return createCapabilityPlan({
    goal: goalPlan.goal,
    projectSlug: goalPlan.project,
    expectedHeadSha,
    registryHash: registrySnapshot.registryHash,
    requestedAuthority,
    strategicLenses: goalPlan.strategicLenses,
    routingReason,
    capabilities,
    proofRequirements: goalPlan.proofRequirements,
    outcomeSignals: [goalPlan.definitionOfDone],
    rollback: goalPlan.rollback,
  });
}

export function createExecutionHandoffReceipt(capabilityPlan) {
  const validation = validateCapabilityPlan(capabilityPlan);
  if (!validation.valid) throw new Error(`Capability plan is invalid: ${validation.errors.join('; ')}`);

  return Object.freeze({
    contract: EXECUTION_HANDOFF_CONTRACT,
    status: 'proposed',
    actionAuthority: false,
    requiresFounderApproval: true,
    selectedBy: capabilityPlan.selectedBy,
    goal: capabilityPlan.goal,
    projectSlug: capabilityPlan.projectSlug,
    expectedHeadSha: capabilityPlan.expectedHeadSha,
    registryHash: capabilityPlan.registryHash,
    requestedAuthority: capabilityPlan.requestedAuthority,
    capabilityIds: capabilityPlan.capabilities.map((capability) => capability.id),
    proofRequirements: [...capabilityPlan.proofRequirements],
    rollback: capabilityPlan.rollback,
    capabilityPlanHash: capabilityPlan.planHash,
  });
}
