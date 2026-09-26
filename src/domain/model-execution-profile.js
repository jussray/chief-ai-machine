// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const MODEL_EXECUTION_PLAN_CONTRACT = 'juss/model-execution-plan@v1';

const SHARED_MAY_ADAPT = Object.freeze([
  'context-packaging',
  'reasoning-strategy',
  'tool-selection',
  'handoff-format',
  'verification-plan',
]);

const SHARED_MAY_NOT_ADAPT = Object.freeze([
  'truth-state',
  'authority-state',
  'founder-approval',
  'proof-state',
  'project-canon',
]);

export const MODEL_EXECUTION_PROFILES = Object.freeze({
  'chatgpt-sol': Object.freeze({
    profileId: 'chatgpt-sol',
    provider: 'openai',
    runtimeIdentitySource: 'observe-per-run',
    toolAvailabilitySource: 'observe-per-run',
    truthSource: 'shared-evidence-spine',
    executionBias: Object.freeze([
      'cross-system-reconciliation',
      'tool-and-connector-orchestration',
      'multimodal-product-analysis',
      'founder-readable-decision-synthesis',
    ]),
  }),
  'claude-code': Object.freeze({
    profileId: 'claude-code',
    provider: 'anthropic',
    runtimeIdentitySource: 'observe-per-run',
    toolAvailabilitySource: 'observe-per-run',
    truthSource: 'shared-evidence-spine',
    executionBias: Object.freeze([
      'long-context-repository-analysis',
      'focused-implementation',
      'careful-refactor-planning',
      'structured-documentation',
    ]),
  }),
});

function cleanText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(values, maxItems = 100, maxLength = 1000) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

export function modelExecutionProfile(profileId) {
  return MODEL_EXECUTION_PROFILES[profileId] ?? null;
}

export function compileModelExecutionPlan(input = {}) {
  const profile = modelExecutionProfile(cleanText(input.profileId, 80));
  if (!profile) throw new Error('unknown_model_execution_profile');

  const observedRuntimeModel = cleanText(input.observedRuntimeModel, 200);
  if (!observedRuntimeModel) throw new Error('runtime_model_identity_required');

  const sourceTruthRefs = cleanStringList(input.sourceTruthRefs, 100, 1000);
  if (sourceTruthRefs.length === 0) throw new Error('source_truth_reference_required');

  return Object.freeze({
    contract: MODEL_EXECUTION_PLAN_CONTRACT,
    profileId: profile.profileId,
    provider: profile.provider,
    observedRuntimeModel,
    observedCapabilities: cleanStringList(input.observedCapabilities, 100, 240),
    sourceTruthRefs,
    authorityRequired: cleanStringList(input.authorityRequired, 50, 240),
    proofRequired: cleanStringList(input.proofRequired, 50, 500),
    claims: cleanStringList(input.claims, 100, 2000),
    unknowns: cleanStringList(input.unknowns, 100, 2000),
    continuityFingerprint: cleanText(input.continuityFingerprint, 500),
    executionBias: profile.executionBias,
    mayAdapt: SHARED_MAY_ADAPT,
    mayNotAdapt: SHARED_MAY_NOT_ADAPT,
    truthSource: profile.truthSource,
    acceptsModelConsensusAsProof: false,
    requiresIndependentEvidenceForTruthUpgrade: true,
    executionAuthorized: false,
    authorityTransferred: false,
    founderApprovalCarriedForward: false,
  });
}
