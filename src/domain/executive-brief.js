// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const EXECUTIVE_BRIEF_SCHEMA_VERSION = 1;

export const REALITY_STATES = Object.freeze([
  'verified',
  'inferred',
  'unknown',
  'blocked',
]);

export const EXECUTIVE_BRIEF_STATUSES = Object.freeze([
  'draft',
  'reviewed',
  'approved',
  'superseded',
]);

const REALITY_STATE_SET = new Set(REALITY_STATES);
const STATUS_SET = new Set(EXECUTIVE_BRIEF_STATUSES);

function cleanText(value, maxLength = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(values, maxItems = 20, maxLength = 500) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanRealityItems(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    state: REALITY_STATE_SET.has(item?.state) ? item.state : 'unknown',
    statement: cleanText(item?.statement, 2000),
    sourceRefs: cleanStringList(item?.sourceRefs, 20, 500),
  })).filter((item) => item.statement).slice(0, 50);
}

function cleanDissent(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    role: cleanText(item?.role, 120) || 'unspecified',
    position: cleanText(item?.position, 1000),
    reason: cleanText(item?.reason, 2000),
  })).filter((item) => item.position || item.reason).slice(0, 20);
}

function briefId(now, decision = '') {
  const seed = cleanText(decision, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `brief-${now.getTime()}-${seed || 'executive'}`;
}

export function createExecutiveBrief(input, now = new Date()) {
  const decision = cleanText(input?.decision, 2000);
  const rationale = cleanText(input?.rationale, 5000);
  const nextGate = cleanText(input?.nextGate, 2000);
  const reality = cleanRealityItems(input?.reality);
  const confidence = Number(input?.confidence);

  if (!decision) throw new Error('Executive brief decision is required');
  if (!rationale) throw new Error('Executive brief rationale is required');
  if (!nextGate) throw new Error('Executive brief next gate is required');
  if (reality.length === 0) throw new Error('Executive brief reality evidence is required');
  if (!Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
    throw new Error('Executive brief confidence must be an integer from 0 to 100');
  }

  const status = STATUS_SET.has(input?.status) ? input.status : 'draft';
  const createdAt = cleanText(input?.createdAt, 40) || now.toISOString();

  return {
    schemaVersion: EXECUTIVE_BRIEF_SCHEMA_VERSION,
    id: cleanText(input?.id, 180) || briefId(now, decision),
    workspaceId: cleanText(input?.workspaceId, 120) || 'default',
    projectId: cleanText(input?.projectId, 120) || 'general',
    decision,
    reality,
    rationale,
    dissent: cleanDissent(input?.dissent),
    confidence,
    risks: cleanStringList(input?.risks, 30, 2000),
    nextGate,
    status,
    source: cleanText(input?.source, 500) || 'manual',
    createdAt,
    updatedAt: now.toISOString(),
  };
}

export function validateExecutiveBrief(brief) {
  const errors = [];

  if (!brief || typeof brief !== 'object') {
    return { valid: false, errors: ['Executive brief must be an object'] };
  }

  if (brief.schemaVersion !== EXECUTIVE_BRIEF_SCHEMA_VERSION) errors.push('Unsupported schema version');
  if (!cleanText(brief.id, 180)) errors.push('Missing id');
  if (!cleanText(brief.decision, 2000)) errors.push('Missing decision');
  if (!cleanText(brief.rationale, 5000)) errors.push('Missing rationale');
  if (!cleanText(brief.nextGate, 2000)) errors.push('Missing next gate');
  if (!STATUS_SET.has(brief.status)) errors.push('Unsupported status');
  if (!Number.isInteger(brief.confidence) || brief.confidence < 0 || brief.confidence > 100) {
    errors.push('Confidence must be an integer from 0 to 100');
  }
  if (!Array.isArray(brief.reality) || brief.reality.length === 0) {
    errors.push('Reality evidence must be a non-empty array');
  } else {
    brief.reality.forEach((item, index) => {
      if (!REALITY_STATE_SET.has(item?.state)) errors.push(`Reality item ${index + 1} has an unsupported state`);
      if (!cleanText(item?.statement, 2000)) errors.push(`Reality item ${index + 1} is missing a statement`);
      if (!Array.isArray(item?.sourceRefs)) errors.push(`Reality item ${index + 1} sourceRefs must be an array`);
    });
  }
  if (!Array.isArray(brief.dissent)) errors.push('Dissent must be an array');
  if (!Array.isArray(brief.risks)) errors.push('Risks must be an array');

  const hasVerifiedReality = Array.isArray(brief.reality)
    && brief.reality.some((item) => item?.state === 'verified');
  if ((brief.status === 'reviewed' || brief.status === 'approved') && !hasVerifiedReality) {
    errors.push('Reviewed or approved briefs require at least one verified reality item');
  }

  return { valid: errors.length === 0, errors };
}

export function assessExecutiveBrief(brief) {
  const validation = validateExecutiveBrief(brief);
  const warnings = [];

  if (!validation.valid) return { ...validation, warnings };

  const verifiedItems = brief.reality.filter((item) => item.state === 'verified');
  const unresolvedItems = brief.reality.filter((item) => item.state === 'unknown' || item.state === 'blocked');

  if (verifiedItems.length === 0) warnings.push('No reality item is verified');
  if (verifiedItems.some((item) => item.sourceRefs.length === 0)) {
    warnings.push('One or more verified reality items have no source reference');
  }
  if (brief.dissent.length === 0) warnings.push('No dissent or alternative position is recorded');
  if (brief.risks.length === 0) warnings.push('No residual risk is recorded');
  if (brief.confidence >= 80 && unresolvedItems.length > 0) {
    warnings.push('High confidence is paired with unknown or blocked reality items');
  }

  return { valid: true, errors: [], warnings };
}
