// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { CLAIM_STATES } from './evidence-decision-loop.js';

export const FOUNDER_RESEARCH_OPERATOR_CONTRACT = 'juss/founder-research-verification-operator@v1';

export const RESEARCH_DEPLOYMENT_CONTEXTS = Object.freeze({
  standalone: 'chief.jussco.company',
  fcr: 'chief.foundercontrolroom.org',
});

export const RESEARCH_TASK_STATUSES = Object.freeze([
  'queued',
  'researching',
  'ready_for_review',
  'blocked',
  'closed',
]);

const STATUS_SET = new Set(RESEARCH_TASK_STATUSES);
const CONTEXT_SET = new Set(Object.keys(RESEARCH_DEPLOYMENT_CONTEXTS));
const CLAIM_STATE_SET = new Set(CLAIM_STATES);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const HASH = /^[0-9a-f]{64}$/i;

function cleanText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanList(values, maxItems = 30, maxLength = 500) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))]
    .slice(0, maxItems);
}

function normalizeSources(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 50).map((source) => ({
    ref: cleanText(source?.ref, 1000),
    kind: cleanText(source?.kind, 80),
    capturedAt: cleanText(source?.capturedAt, 40),
    contentHash: cleanText(source?.contentHash, 64).toLowerCase(),
    trust: ['primary', 'secondary', 'user-provided', 'repository', 'runtime', 'unknown'].includes(source?.trust)
      ? source.trust
      : 'unknown',
  })).filter((source) => source.ref);
}

function normalizeFindings(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 100).map((finding) => ({
    state: CLAIM_STATE_SET.has(finding?.state) ? finding.state : 'UNKNOWN',
    statement: cleanText(finding?.statement, 3000),
    sourceRefs: cleanList(finding?.sourceRefs, 30, 1000),
    confidence: Number.isInteger(finding?.confidence) && finding.confidence >= 0 && finding.confidence <= 100
      ? finding.confidence
      : 0,
  })).filter((finding) => finding.statement);
}

function normalizeRedTeam(values) {
  if (!Array.isArray(values)) return [];
  return values.slice(0, 50).map((item) => ({
    risk: cleanText(item?.risk, 2000),
    severity: SEVERITIES.has(item?.severity) ? item.severity : 'medium',
    falsifier: cleanText(item?.falsifier, 2000),
    mitigation: cleanText(item?.mitigation, 2000),
    sourceRefs: cleanList(item?.sourceRefs, 20, 1000),
  })).filter((item) => item.risk);
}

export function createFounderResearchTask(input = {}, now = new Date()) {
  const goal = cleanText(input.goal, 3000);
  const deploymentContext = CONTEXT_SET.has(input.deploymentContext) ? input.deploymentContext : '';
  if (!goal) throw new Error('Research task goal is required');
  if (!deploymentContext) throw new Error('Research task deploymentContext must be standalone or fcr');

  const task = {
    contract: FOUNDER_RESEARCH_OPERATOR_CONTRACT,
    id: cleanText(input.id, 180) || `research-${now.getTime()}`,
    role: 'Founder Research & Verification Operator',
    owner: 'chief-ai-machine',
    goal,
    deploymentContext,
    domain: RESEARCH_DEPLOYMENT_CONTEXTS[deploymentContext],
    scope: cleanList(input.scope, 30, 500),
    status: STATUS_SET.has(input.status) ? input.status : 'queued',
    sources: normalizeSources(input.sources),
    findings: normalizeFindings(input.findings),
    redTeam: normalizeRedTeam(input.redTeam),
    recommendation: cleanText(input.recommendation, 3000),
    createdAt: cleanText(input.createdAt, 40) || now.toISOString(),
    updatedAt: now.toISOString(),
    authority: Object.freeze({
      mode: 'research-only',
      mayRead: true,
      mayCompare: true,
      mayVerify: true,
      mayWriteExternally: false,
      mayPublish: false,
      maySpend: false,
      mayDeploy: false,
      mayMerge: false,
      mayChangeAccess: false,
      requiresFounderControlRoomDecisionForConsequentialAction: true,
    }),
    handoff: Object.freeze({
      to: 'chief',
      evidenceConsumer: 'founder-control-room',
      promptPolicyOwner: 'promptos',
      continuityOwner: 'solcontinuity',
      executionAuthority: false,
      founderDecisionRequired: true,
    }),
  };

  const validation = validateFounderResearchTask(task);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return task;
}

export function validateFounderResearchTask(task) {
  const errors = [];
  if (!task || typeof task !== 'object') {
    return { valid: false, errors: ['Research task must be an object'] };
  }

  if (task.contract !== FOUNDER_RESEARCH_OPERATOR_CONTRACT) errors.push('Unsupported research operator contract');
  if (!cleanText(task.id, 180)) errors.push('Research task id is required');
  if (task.role !== 'Founder Research & Verification Operator') errors.push('Unsupported research operator role');
  if (task.owner !== 'chief-ai-machine') errors.push('Research operator must be owned by Chief AI Machine');
  if (!cleanText(task.goal, 3000)) errors.push('Research task goal is required');
  if (!CONTEXT_SET.has(task.deploymentContext)) errors.push('Unsupported research deployment context');
  else if (task.domain !== RESEARCH_DEPLOYMENT_CONTEXTS[task.deploymentContext]) {
    errors.push('Research domain does not match its deployment context');
  }
  if (!Array.isArray(task.scope) || task.scope.length > 30) errors.push('Research scope must be an array of at most 30 items');
  if (!STATUS_SET.has(task.status)) errors.push('Unsupported research task status');
  if (!Array.isArray(task.sources) || task.sources.length > 50) errors.push('Research sources must be an array of at most 50 items');
  if (!Array.isArray(task.findings) || task.findings.length > 100) errors.push('Research findings must be an array of at most 100 items');
  if (!Array.isArray(task.redTeam) || task.redTeam.length > 50) errors.push('Red-team findings must be an array of at most 50 items');

  const sourceRefs = new Set();
  for (const source of Array.isArray(task.sources) ? task.sources : []) {
    if (!cleanText(source?.ref, 1000)) errors.push('Every research source requires a reference');
    if (sourceRefs.has(source?.ref)) errors.push(`Duplicate research source reference: ${source.ref}`);
    sourceRefs.add(source?.ref);
    if (!cleanText(source?.kind, 80)) errors.push(`Research source ${source?.ref || '<unknown>'} requires a kind`);
    if (source?.contentHash && !HASH.test(source.contentHash)) {
      errors.push(`Research source ${source?.ref || '<unknown>'} has an invalid content hash`);
    }
    if (source?.capturedAt && !Number.isFinite(Date.parse(source.capturedAt))) {
      errors.push(`Research source ${source?.ref || '<unknown>'} has an invalid capture timestamp`);
    }
  }

  for (const [index, finding] of (Array.isArray(task.findings) ? task.findings : []).entries()) {
    if (!CLAIM_STATE_SET.has(finding?.state)) errors.push(`Finding ${index + 1} has an unsupported claim state`);
    if (!cleanText(finding?.statement, 3000)) errors.push(`Finding ${index + 1} requires a statement`);
    if (!Array.isArray(finding?.sourceRefs)) errors.push(`Finding ${index + 1} sourceRefs must be an array`);
    else {
      if (new Set(finding.sourceRefs).size !== finding.sourceRefs.length) {
        errors.push(`Finding ${index + 1} sourceRefs must be unique`);
      }
      for (const ref of finding.sourceRefs) {
        if (!sourceRefs.has(ref)) errors.push(`Finding ${index + 1} references an unknown source: ${ref}`);
      }
    }
    if (!Number.isInteger(finding?.confidence) || finding.confidence < 0 || finding.confidence > 100) {
      errors.push(`Finding ${index + 1} confidence must be an integer from 0 to 100`);
    }
    if (['VERIFIED', 'OBSERVED'].includes(finding?.state) && (!Array.isArray(finding.sourceRefs) || finding.sourceRefs.length === 0)) {
      errors.push(`Finding ${index + 1} in state ${finding.state} requires source evidence`);
    }
  }

  for (const [index, item] of (Array.isArray(task.redTeam) ? task.redTeam : []).entries()) {
    if (!cleanText(item?.risk, 2000)) errors.push(`Red-team finding ${index + 1} requires a risk statement`);
    if (!SEVERITIES.has(item?.severity)) errors.push(`Red-team finding ${index + 1} has an unsupported severity`);
    if (!cleanText(item?.falsifier, 2000)) errors.push(`Red-team finding ${index + 1} requires a falsifier`);
    if (!cleanText(item?.mitigation, 2000)) errors.push(`Red-team finding ${index + 1} requires a mitigation`);
    if (!Array.isArray(item?.sourceRefs)) errors.push(`Red-team finding ${index + 1} sourceRefs must be an array`);
    else if (item.sourceRefs.some((ref) => !sourceRefs.has(ref))) {
      errors.push(`Red-team finding ${index + 1} references an unknown source`);
    }
  }

  const authority = task.authority;
  if (authority?.mode !== 'research-only'
    || authority?.mayRead !== true
    || authority?.mayCompare !== true
    || authority?.mayVerify !== true
    || authority?.mayWriteExternally !== false
    || authority?.mayPublish !== false
    || authority?.maySpend !== false
    || authority?.mayDeploy !== false
    || authority?.mayMerge !== false
    || authority?.mayChangeAccess !== false
    || authority?.requiresFounderControlRoomDecisionForConsequentialAction !== true) {
    errors.push('Research operator authority must remain read-only and non-executing');
  }

  if (task.handoff?.to !== 'chief'
    || task.handoff?.evidenceConsumer !== 'founder-control-room'
    || task.handoff?.promptPolicyOwner !== 'promptos'
    || task.handoff?.continuityOwner !== 'solcontinuity'
    || task.handoff?.executionAuthority !== false
    || task.handoff?.founderDecisionRequired !== true) {
    errors.push('Research operator handoff boundaries are invalid');
  }

  return { valid: errors.length === 0, errors };
}
