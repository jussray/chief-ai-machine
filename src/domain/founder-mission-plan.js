// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { sha256Hex } from './capability-plan.js';

export const FOUNDER_MISSION_ENVELOPE_CONTRACT = 'juss/founder-mission-envelope@v1';
export const FCR_WORKFLOW_CANDIDATE_CONTRACT = 'juss/fcr-workflow-candidate@v1';

export const FOUNDER_MISSION_CORE_ARTIFACT_IDS = Object.freeze([
  'mission-brief',
  'system-map',
  'red-team-register',
  'artifact-ledger',
  'bottleneck-map',
  'verification-report',
  'founder-decision-pack',
]);

export const FOUNDER_MISSION_PROOF_LEVELS = Object.freeze([
  'plan-only',
  'local-evidence',
  'exact-head',
  'deployed-observation',
  'outcome-verified',
]);

export const FOUNDER_MISSION_TASK_STATES = Object.freeze([
  'open',
  'active',
  'blocked',
  'proof_pending',
  'proven',
  'cleared',
]);

const PROOF_LEVEL_SET = new Set(FOUNDER_MISSION_PROOF_LEVELS);
const TASK_STATE_SET = new Set(FOUNDER_MISSION_TASK_STATES);
const HASH = /^[0-9a-f]{64}$/i;
const ACTION_ID_SYNTAX = /^[a-z0-9][a-z0-9:_-]{0,127}$/;

const DEFAULT_OWNER_BY_ARTIFACT = Object.freeze({
  'mission-brief': 'chief-ai',
  'system-map': 'chief-ai',
  'red-team-register': 'council',
  'artifact-ledger': 'chief-ai',
  'bottleneck-map': 'chief-ai',
  'verification-report': 'founder-control-room',
  'founder-decision-pack': 'founder',
});

function cleanText(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(values, maxItems = 100, maxLength = 1000) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non_finite_number');
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => {
          if (value[key] === undefined) throw new Error(`undefined_value:${key}`);
          return [key, canonicalize(value[key])];
        }),
    );
  }
  throw new Error('unsupported_value');
}

export function canonicalMissionJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function founderMissionFingerprint(value) {
  return sha256Hex(canonicalMissionJson(value));
}

// This checks only the transport-safe identifier shape. It deliberately does
// not claim registry membership. FCR must validate the identifier against its
// current action/workflow registry before any execution can be authorized.
export function isActionIdSyntaxValid(value) {
  return ACTION_ID_SYNTAX.test(cleanText(value, 256));
}

function defaultArtifact(artifactId) {
  const ownerLane = DEFAULT_OWNER_BY_ARTIFACT[artifactId];
  const supportLanes = ownerLane === 'founder'
    ? ['chief-ai']
    : ownerLane === 'founder-control-room'
      ? ['chief-ai']
      : ['founder'];

  return {
    artifactId,
    ownerLane,
    supportLanes,
    status: 'open',
    requiredProofLevel: artifactId === 'verification-report' ? 'exact-head' : 'plan-only',
    evidenceRefs: [],
    approvalGate: ownerLane === 'founder' ? 'founder' : 'none',
    rollback: 'Discard or supersede this planned artifact without mutating external state.',
  };
}

function normalizeArtifact(artifact) {
  return {
    artifactId: cleanText(artifact?.artifactId, 160),
    ownerLane: cleanText(artifact?.ownerLane, 160),
    supportLanes: cleanStringList(artifact?.supportLanes, 20, 160),
    status: cleanText(artifact?.status, 40),
    requiredProofLevel: cleanText(artifact?.requiredProofLevel, 40),
    evidenceRefs: cleanStringList(artifact?.evidenceRefs, 50, 1000),
    approvalGate: cleanText(artifact?.approvalGate, 40),
    rollback: cleanText(artifact?.rollback, 2000),
  };
}

export function createFounderMissionPlan(input = {}) {
  const artifacts = Array.isArray(input.artifacts) && input.artifacts.length > 0
    ? input.artifacts.map(normalizeArtifact)
    : FOUNDER_MISSION_CORE_ARTIFACT_IDS.map(defaultArtifact);

  const plan = {
    contract: FOUNDER_MISSION_ENVELOPE_CONTRACT,
    selectedBy: 'chief-ai-machine',
    missionId: cleanText(input.missionId, 160),
    goal: cleanText(input.goal),
    preservedConstraints: cleanStringList(input.preservedConstraints, 50, 1000),
    who: cleanText(input.who),
    what: cleanText(input.what),
    where: cleanText(input.where),
    when: cleanText(input.when),
    why: cleanText(input.why),
    how: cleanText(input.how),
    systemMap: cleanStringList(input.systemMap),
    redTeamRegister: cleanStringList(input.redTeamRegister),
    bottleneckMap: cleanStringList(input.bottleneckMap),
    artifacts,
    requestedActionIds: cleanStringList(input.requestedActionIds, 30, 160),
    requiredProofLevel: cleanText(input.requiredProofLevel, 40) || 'exact-head',
    currentProofLevel: cleanText(input.currentProofLevel, 40) || 'plan-only',
    proofState: cleanText(input.proofState, 40) || 'unproven',
    taskState: cleanText(input.taskState, 40) || 'open',
    proofRefs: cleanStringList(input.proofRefs, 50, 1000),
    rollback: cleanText(input.rollback) || 'Discard the Chief plan; it carries no execution authority.',
    version: Number.isInteger(input.version) && input.version > 0 ? input.version : 1,
    predecessorFingerprint: cleanText(input.predecessorFingerprint, 64) || null,
    createdAt: cleanText(input.createdAt, 80),
    authorizesExecution: false,
    authorizesClearance: false,
  };

  return Object.freeze({ ...plan, missionFingerprint: founderMissionFingerprint(plan) });
}

export function validateFounderMissionPlan(plan) {
  const errors = [];

  if (plan?.contract !== FOUNDER_MISSION_ENVELOPE_CONTRACT) errors.push('mission contract drifted');
  if (plan?.selectedBy !== 'chief-ai-machine') errors.push('Chief must remain the mission planner');
  if (!cleanText(plan?.missionId, 160)) errors.push('missionId is required');
  if (!cleanText(plan?.goal)) errors.push('goal is required');

  for (const field of ['who', 'what', 'where', 'when', 'why', 'how']) {
    if (!cleanText(plan?.[field])) errors.push(`${field} is required`);
  }

  if (!PROOF_LEVEL_SET.has(plan?.requiredProofLevel)) errors.push('requiredProofLevel is invalid');
  if (!PROOF_LEVEL_SET.has(plan?.currentProofLevel)) errors.push('currentProofLevel is invalid');
  if (!TASK_STATE_SET.has(plan?.taskState)) errors.push('taskState is invalid');
  if (!['unproven', 'proven'].includes(plan?.proofState)) errors.push('proofState is invalid');

  if (plan?.authorizesExecution !== false) errors.push('Chief mission plans cannot authorize execution');
  if (plan?.authorizesClearance !== false) errors.push('Chief mission plans cannot authorize task clearance');
  if (['proven', 'cleared'].includes(plan?.taskState)) {
    errors.push('Chief cannot self-assert final proven/cleared task state');
  }
  if (plan?.proofState === 'proven') {
    errors.push('Chief cannot self-assert final proof state');
  }

  if (!Number.isInteger(plan?.version) || plan.version < 1) errors.push('version must be a positive integer');
  if (plan?.version > 1 && !HASH.test(plan?.predecessorFingerprint ?? '')) {
    errors.push('successor plans require a predecessor fingerprint');
  }
  if (plan?.version === 1 && plan?.predecessorFingerprint) {
    errors.push('version 1 must not claim a predecessor fingerprint');
  }

  const artifactIds = Array.isArray(plan?.artifacts) ? plan.artifacts.map((artifact) => artifact?.artifactId) : [];
  if (new Set(artifactIds).size !== artifactIds.length) errors.push('artifact IDs must be unique');
  for (const requiredId of FOUNDER_MISSION_CORE_ARTIFACT_IDS) {
    if (!artifactIds.includes(requiredId)) errors.push(`missing core artifact ${requiredId}`);
  }

  for (const artifact of plan?.artifacts ?? []) {
    if (!cleanText(artifact?.ownerLane, 160)) errors.push(`artifact ${artifact?.artifactId ?? '<unknown>'} requires one owner lane`);
    if (artifact?.supportLanes?.includes(artifact?.ownerLane)) {
      errors.push(`artifact ${artifact.artifactId} owner lane cannot also be a support lane`);
    }
  }

  for (const actionId of plan?.requestedActionIds ?? []) {
    if (!isActionIdSyntaxValid(actionId)) errors.push(`invalid/free-form action identifier syntax: ${actionId}`);
  }

  if (!cleanText(plan?.rollback)) errors.push('rollback is required');
  if (!cleanText(plan?.createdAt, 80)) errors.push('createdAt is required');

  const fingerprintPayload = { ...plan };
  delete fingerprintPayload.missionFingerprint;
  if (plan?.missionFingerprint !== founderMissionFingerprint(fingerprintPayload)) {
    errors.push('mission fingerprint mismatch');
  }

  return { valid: errors.length === 0, errors };
}

export function createFounderMissionPlanSuccessor(prior, input = {}) {
  const priorValidation = validateFounderMissionPlan(prior);
  if (!priorValidation.valid) throw new Error(`prior mission plan invalid: ${priorValidation.errors.join('; ')}`);
  if (cleanText(input.missionId, 160) && cleanText(input.missionId, 160) !== prior.missionId) {
    throw new Error('mission identity cannot change across append-only successors');
  }

  return createFounderMissionPlan({
    ...prior,
    ...input,
    missionId: prior.missionId,
    version: prior.version + 1,
    predecessorFingerprint: prior.missionFingerprint,
    proofState: 'unproven',
    taskState: input.taskState ?? 'proof_pending',
  });
}

export function compileFcrWorkflowCandidate(plan, input = {}) {
  const validation = validateFounderMissionPlan(plan);
  if (!validation.valid) throw new Error(`mission plan invalid: ${validation.errors.join('; ')}`);

  const candidate = {
    contract: FCR_WORKFLOW_CANDIDATE_CONTRACT,
    compiledBy: 'chief-ai-machine',
    sourceMissionId: plan.missionId,
    sourceMissionFingerprint: plan.missionFingerprint,
    workflowId: cleanText(input.workflowId, 160),
    publicLabel: cleanText(input.publicLabel, 240),
    userOutcome: cleanText(input.userOutcome),
    sourceProject: cleanText(input.sourceProject, 240),
    lane: cleanText(input.lane, 160),
    northStar: cleanText(input.northStar),
    internalStack: cleanStringList(input.internalStack, 60, 240),
    inputs: cleanStringList(input.inputs, 60, 1000),
    outputs: cleanStringList(input.outputs, 60, 1000),
    authorityRequired: cleanStringList(input.authorityRequired, 60, 240),
    connectedTools: cleanStringList(input.connectedTools, 60, 240),
    modelRoute: cleanStringList(input.modelRoute, 30, 240),
    councilRoute: cleanStringList(input.councilRoute, 30, 240),
    proofRequired: cleanStringList(input.proofRequired, 60, 1000),
    requiredProofStage: cleanText(input.requiredProofStage, 80) || plan.requiredProofLevel,
    rollback: cleanStringList(input.rollback, 20, 1000),
    privacyClass: cleanText(input.privacyClass, 160) || 'unknown',
    costBudget: cleanText(input.costBudget, 160) || 'unknown',
    successSignal: cleanStringList(input.successSignal, 40, 1000),
    failureSignal: cleanStringList(input.failureSignal, 40, 1000),
    repeatabilityEvidence: cleanStringList(input.repeatabilityEvidence, 40, 1000),
    graduationStatus: cleanText(input.graduationStatus, 80) || 'candidate',
    taskClearanceRule: 'FCR clears only after required proof is proven; Chief recommendation cannot clear the task.',
    authorizesExecution: false,
    authorizesClearance: false,
  };

  return Object.freeze({ ...candidate, candidateFingerprint: founderMissionFingerprint(candidate) });
}
