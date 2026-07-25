// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { REALITY_STATES } from './executive-brief.js';

export const SPECIALIST_REPORT_SCHEMA_VERSION = 1;

export const SPECIALIST_POSITIONS = Object.freeze([
  'support',
  'conditional',
  'oppose',
  'abstain',
]);

export const SPECIALIST_REPORT_STATUSES = Object.freeze([
  'draft',
  'reviewed',
  'approved',
  'superseded',
]);

const REALITY_STATE_SET = new Set(REALITY_STATES);
const POSITION_SET = new Set(SPECIALIST_POSITIONS);
const STATUS_SET = new Set(SPECIALIST_REPORT_STATUSES);

function cleanText(value, maxLength = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(values, maxItems = 30, maxLength = 2000) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function cleanReceiptIds(values) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new Error('Specialist reality receiptIds must be an array');
  const cleaned = values.map((value) => {
    if (typeof value !== 'string') throw new Error('Specialist reality receipt id must be a string');
    const receiptId = value.trim();
    if (receiptId.length > 180) throw new Error('Specialist reality receipt id exceeds 180 characters');
    return receiptId;
  }).filter(Boolean);
  const unique = [...new Set(cleaned)];
  if (unique.length > 20) throw new Error('Specialist reality receiptIds exceed 20 unique items');
  return unique;
}

function cleanRealityItems(items) {
  if (!Array.isArray(items)) return [];

  return items.map((item) => ({
    state: REALITY_STATE_SET.has(item?.state) ? item.state : 'unknown',
    statement: cleanText(item?.statement, 2000),
    sourceRefs: cleanStringList(item?.sourceRefs, 20, 500),
    receiptIds: cleanReceiptIds(item?.receiptIds),
  })).filter((item) => item.statement).slice(0, 50);
}

function reportId(now, domain = '') {
  const seed = cleanText(domain, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `specialist-${now.getTime()}-${seed || 'report'}`;
}

export function createSpecialistReport(input, now = new Date()) {
  const role = cleanText(input?.role, 120);
  const domain = cleanText(input?.domain, 120).toLowerCase();
  const position = POSITION_SET.has(input?.position) ? input.position : '';
  const conclusion = cleanText(input?.conclusion, 3000);
  const recommendation = cleanText(input?.recommendation, 3000);
  const reality = cleanRealityItems(input?.reality);
  const confidence = input?.confidence;
  const dependencies = cleanStringList(input?.dependencies);

  if (!role) throw new Error('Specialist role is required');
  if (!domain) throw new Error('Specialist domain is required');
  if (!position) throw new Error('Specialist position is required');
  if (!conclusion) throw new Error('Specialist conclusion is required');
  if (!recommendation) throw new Error('Specialist recommendation is required');
  if (reality.length === 0) throw new Error('Specialist reality evidence is required');
  if (typeof confidence !== 'number' || !Number.isInteger(confidence) || confidence < 0 || confidence > 100) {
    throw new Error('Specialist confidence must be an integer from 0 to 100');
  }
  if (position === 'conditional' && dependencies.length === 0) {
    throw new Error('Conditional specialist reports require at least one dependency');
  }

  const status = STATUS_SET.has(input?.status) ? input.status : 'draft';
  const createdAt = cleanText(input?.createdAt, 40) || now.toISOString();

  return {
    schemaVersion: SPECIALIST_REPORT_SCHEMA_VERSION,
    id: cleanText(input?.id, 180) || reportId(now, domain),
    workspaceId: cleanText(input?.workspaceId, 120) || 'default',
    projectId: cleanText(input?.projectId, 120) || 'general',
    role,
    domain,
    position,
    conclusion,
    recommendation,
    reality,
    assumptions: cleanStringList(input?.assumptions),
    confidence,
    risks: cleanStringList(input?.risks),
    dependencies,
    status,
    source: cleanText(input?.source, 500) || 'manual',
    createdAt,
    updatedAt: now.toISOString(),
  };
}

export function validateSpecialistReport(report) {
  const errors = [];

  if (!report || typeof report !== 'object') {
    return { valid: false, errors: ['Specialist report must be an object'] };
  }

  if (report.schemaVersion !== SPECIALIST_REPORT_SCHEMA_VERSION) errors.push('Unsupported schema version');
  if (!cleanText(report.id, 180)) errors.push('Missing id');
  if (!cleanText(report.workspaceId, 120)) errors.push('Missing workspace id');
  if (!cleanText(report.projectId, 120)) errors.push('Missing project id');
  if (!cleanText(report.role, 120)) errors.push('Missing role');
  if (!cleanText(report.domain, 120)) errors.push('Missing domain');
  if (!POSITION_SET.has(report.position)) errors.push('Unsupported position');
  if (!cleanText(report.conclusion, 3000)) errors.push('Missing conclusion');
  if (!cleanText(report.recommendation, 3000)) errors.push('Missing recommendation');
  if (!STATUS_SET.has(report.status)) errors.push('Unsupported status');
  if (typeof report.confidence !== 'number' || !Number.isInteger(report.confidence) || report.confidence < 0 || report.confidence > 100) {
    errors.push('Confidence must be an integer from 0 to 100');
  }
  if (!Array.isArray(report.reality) || report.reality.length === 0) {
    errors.push('Reality evidence must be a non-empty array');
  } else {
    report.reality.forEach((item, index) => {
      if (!REALITY_STATE_SET.has(item?.state)) errors.push(`Reality item ${index + 1} has an unsupported state`);
      if (!cleanText(item?.statement, 2000)) errors.push(`Reality item ${index + 1} is missing a statement`);
      if (!Array.isArray(item?.sourceRefs) || item.sourceRefs.length > 20) {
        errors.push(`Reality item ${index + 1} sourceRefs must contain at most 20 items`);
      }
      const receiptIds = item?.receiptIds ?? [];
      if (!Array.isArray(receiptIds) || receiptIds.length > 20) {
        errors.push(`Reality item ${index + 1} receiptIds must contain at most 20 items`);
      } else {
        if (new Set(receiptIds).size !== receiptIds.length) {
          errors.push(`Reality item ${index + 1} receiptIds must be unique`);
        }
        if (receiptIds.some((receiptId) => !cleanText(receiptId, 180) || receiptId.length > 180)) {
          errors.push(`Reality item ${index + 1} has an invalid receipt id`);
        }
      }
    });
  }
  if (!Array.isArray(report.assumptions)) errors.push('Assumptions must be an array');
  if (!Array.isArray(report.risks)) errors.push('Risks must be an array');
  if (!Array.isArray(report.dependencies)) errors.push('Dependencies must be an array');
  if (report.position === 'conditional' && Array.isArray(report.dependencies) && report.dependencies.length === 0) {
    errors.push('Conditional reports require at least one dependency');
  }

  const hasVerifiedReality = Array.isArray(report.reality)
    && report.reality.some((item) => item?.state === 'verified');
  if ((report.status === 'reviewed' || report.status === 'approved') && !hasVerifiedReality) {
    errors.push('Reviewed or approved specialist reports require at least one verified reality item');
  }

  return { valid: errors.length === 0, errors };
}

export function assessSpecialistReport(report) {
  const validation = validateSpecialistReport(report);
  const warnings = [];

  if (!validation.valid) return { ...validation, warnings };

  const verifiedItems = report.reality.filter((item) => item.state === 'verified');
  const unresolvedItems = report.reality.filter((item) => item.state === 'unknown' || item.state === 'blocked');

  if (verifiedItems.length === 0) warnings.push('No specialist reality item is verified');
  if (verifiedItems.some((item) => item.sourceRefs.length === 0)) {
    warnings.push('One or more verified specialist reality items have no source reference');
  }
  if (report.risks.length === 0) warnings.push('No specialist risk is recorded');
  if (report.confidence >= 80 && unresolvedItems.length > 0) {
    warnings.push('High specialist confidence is paired with unknown or blocked reality items');
  }

  return { valid: true, errors: [], warnings };
}
