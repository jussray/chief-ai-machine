// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import {
  createSpecialistReport,
  validateSpecialistReport,
} from './specialist-report.js';

export const CONTROL_ROOM_EVIDENCE_SCHEMA_VERSION = 1;
export const CONTROL_ROOM_INGESTION_SCHEMA_VERSION = 1;

export const CONTROL_ROOM_EVIDENCE_STATES = Object.freeze([
  'verified',
  'unknown',
  'blocked',
]);

export const CONTROL_ROOM_EVIDENCE_KINDS = Object.freeze([
  'repository',
  'pull-request',
  'workflow',
  'deployment',
  'runtime',
  'crm',
  'communication',
  'incident',
  'rollback',
  'other',
]);

export const CONTROL_ROOM_RECEIPT_STATUSES = Object.freeze([
  'active',
  'superseded',
  'revoked',
]);

export const CONTROL_ROOM_EVIDENCE_AUTHORITY = Object.freeze({
  scope: 'evidence-only',
  instructionPolicy: 'data-only',
  permitsRepositoryWrite: false,
  permitsExecution: false,
  permitsDeployment: false,
  permitsPublishing: false,
  permitsBilling: false,
  permitsApproval: false,
  permitsSecretMutation: false,
  permitsDestructiveAction: false,
});

const EVIDENCE_STATE_SET = new Set(CONTROL_ROOM_EVIDENCE_STATES);
const EVIDENCE_KIND_SET = new Set(CONTROL_ROOM_EVIDENCE_KINDS);
const RECEIPT_STATUS_SET = new Set(CONTROL_ROOM_RECEIPT_STATUSES);

function cleanText(value, maxLength = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isBoundedText(value, maxLength, required = true) {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  if (required && !text) return false;
  return text.length <= maxLength;
}

function boundedText(value, maxLength, label) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const text = value.trim();
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters`);
  return text;
}

function boundedStringList(values, maxItems, maxLength, label) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new Error(`${label} must be an array`);
  const cleaned = values.map((value) => boundedText(value, maxLength, `${label} item`)).filter(Boolean);
  const unique = [...new Set(cleaned)];
  if (unique.length > maxItems) throw new Error(`${label} exceeds ${maxItems} unique items`);
  return unique;
}

function cleanIsoTimestamp(value) {
  const text = cleanText(value, 40);
  if (!text || Number.isNaN(Date.parse(text))) return '';
  return new Date(text).toISOString();
}

function authorityCopy() {
  return { ...CONTROL_ROOM_EVIDENCE_AUTHORITY };
}

function authorityIsEvidenceOnly(authority) {
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) return false;
  const expectedKeys = Object.keys(CONTROL_ROOM_EVIDENCE_AUTHORITY).sort();
  const actualKeys = Object.keys(authority).sort();
  if (expectedKeys.length !== actualKeys.length
    || expectedKeys.some((key, index) => key !== actualKeys[index])) return false;

  return authority.scope === CONTROL_ROOM_EVIDENCE_AUTHORITY.scope
    && authority.instructionPolicy === CONTROL_ROOM_EVIDENCE_AUTHORITY.instructionPolicy
    && authority.permitsRepositoryWrite === false
    && authority.permitsExecution === false
    && authority.permitsDeployment === false
    && authority.permitsPublishing === false
    && authority.permitsBilling === false
    && authority.permitsApproval === false
    && authority.permitsSecretMutation === false
    && authority.permitsDestructiveAction === false;
}

function receiptId(now, kind = '', subjectId = '') {
  const seed = `${cleanText(kind, 40)}-${cleanText(subjectId, 80)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `control-room-receipt-${now.getTime()}-${seed || 'evidence'}`;
}

function ingestionId(now, projectId = '') {
  const seed = cleanText(projectId, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `control-room-ingestion-${now.getTime()}-${seed || 'evidence'}`;
}

export function createControlRoomEvidenceReceipt(input, now = new Date()) {
  const kind = input?.kind;
  const state = input?.state;
  const status = input?.status ?? 'active';
  const statement = boundedText(input?.statement, 2000, 'Control Room evidence statement');
  const sourceRefs = boundedStringList(input?.sourceRefs, 20, 500, 'Control Room source references');
  const sourceRecordId = boundedText(input?.sourceRecordId, 180, 'Control Room source record id');
  const subjectType = boundedText(input?.subjectType, 120, 'Control Room subject type');
  const subjectId = boundedText(input?.subjectId, 180, 'Control Room subject id');
  const observedAt = cleanIsoTimestamp(input?.observedAt);

  if (!EVIDENCE_KIND_SET.has(kind)) throw new Error('Control Room evidence kind is unsupported');
  if (!EVIDENCE_STATE_SET.has(state)) throw new Error('Control Room evidence state is unsupported');
  if (!RECEIPT_STATUS_SET.has(status)) throw new Error('Control Room receipt status is unsupported');
  if (!statement) throw new Error('Control Room evidence statement is required');
  if (!sourceRecordId) throw new Error('Control Room source record id is required');
  if (!subjectType) throw new Error('Control Room subject type is required');
  if (!subjectId) throw new Error('Control Room subject id is required');
  if (!observedAt) throw new Error('Control Room observed timestamp must be a valid date');
  if (state === 'verified' && sourceRefs.length === 0) {
    throw new Error('Verified Control Room evidence requires at least one source reference');
  }

  return {
    schemaVersion: CONTROL_ROOM_EVIDENCE_SCHEMA_VERSION,
    id: boundedText(input?.id, 180, 'Control Room receipt id') || receiptId(now, kind, subjectId),
    workspaceId: boundedText(input?.workspaceId, 120, 'Control Room workspace id') || 'default',
    projectId: boundedText(input?.projectId, 120, 'Control Room project id') || 'general',
    sourceSystem: 'founder-control-room',
    sourceRecordId,
    sourceRevision: boundedText(input?.sourceRevision, 180, 'Control Room source revision'),
    kind,
    subjectType,
    subjectId,
    subjectRef: boundedText(input?.subjectRef, 500, 'Control Room subject reference'),
    state,
    statement,
    sourceRefs,
    status,
    supersedesReceiptId: boundedText(input?.supersedesReceiptId, 180, 'Superseded receipt id'),
    observedAt,
    recordedAt: now.toISOString(),
    authority: authorityCopy(),
  };
}

export function validateControlRoomEvidenceReceipt(receipt) {
  const errors = [];

  if (!receipt || typeof receipt !== 'object') {
    return { valid: false, errors: ['Control Room evidence receipt must be an object'] };
  }

  if (receipt.schemaVersion !== CONTROL_ROOM_EVIDENCE_SCHEMA_VERSION) errors.push('Unsupported schema version');
  if (!isBoundedText(receipt.id, 180)) errors.push('Missing or invalid id');
  if (!isBoundedText(receipt.workspaceId, 120)) errors.push('Missing or invalid workspace id');
  if (!isBoundedText(receipt.projectId, 120)) errors.push('Missing or invalid project id');
  if (receipt.sourceSystem !== 'founder-control-room') errors.push('Unsupported source system');
  if (!isBoundedText(receipt.sourceRecordId, 180)) errors.push('Missing or invalid source record id');
  if (!EVIDENCE_KIND_SET.has(receipt.kind)) errors.push('Unsupported evidence kind');
  if (!isBoundedText(receipt.subjectType, 120)) errors.push('Missing or invalid subject type');
  if (!isBoundedText(receipt.subjectId, 180)) errors.push('Missing or invalid subject id');
  if (!EVIDENCE_STATE_SET.has(receipt.state)) errors.push('Unsupported evidence state');
  if (!isBoundedText(receipt.statement, 2000)) errors.push('Missing or invalid evidence statement');
  if (!Array.isArray(receipt.sourceRefs) || receipt.sourceRefs.length > 20) {
    errors.push('Source references must be an array with at most 20 items');
  } else {
    if (new Set(receipt.sourceRefs).size !== receipt.sourceRefs.length) {
      errors.push('Source references must be unique');
    }
    if (receipt.sourceRefs.some((sourceRef) => !isBoundedText(sourceRef, 500))) {
      errors.push('Source references contain an invalid item');
    }
  }
  if (receipt.state === 'verified' && Array.isArray(receipt.sourceRefs) && receipt.sourceRefs.length === 0) {
    errors.push('Verified evidence requires at least one source reference');
  }
  if (!isBoundedText(receipt.sourceRevision ?? '', 180, false)) errors.push('Invalid source revision');
  if (!isBoundedText(receipt.subjectRef ?? '', 500, false)) errors.push('Invalid subject reference');
  if (!isBoundedText(receipt.supersedesReceiptId ?? '', 180, false)) errors.push('Invalid superseded receipt id');
  if (receipt.supersedesReceiptId && receipt.supersedesReceiptId === receipt.id) {
    errors.push('Receipt cannot supersede itself');
  }
  if (!RECEIPT_STATUS_SET.has(receipt.status)) errors.push('Unsupported receipt status');
  if (!cleanIsoTimestamp(receipt.observedAt)) errors.push('Invalid observed timestamp');
  if (!cleanIsoTimestamp(receipt.recordedAt)) errors.push('Invalid recorded timestamp');
  if (!authorityIsEvidenceOnly(receipt.authority)) errors.push('Receipt authority must remain evidence-only');

  return { valid: errors.length === 0, errors };
}

export function assessControlRoomEvidenceReceipt(receipt) {
  const validation = validateControlRoomEvidenceReceipt(receipt);
  const warnings = [];

  if (!validation.valid) return { ...validation, warnings };

  if (receipt.status !== 'active') warnings.push('Receipt is not active and must not be ingested');
  if (receipt.state === 'unknown') warnings.push('Control Room evidence remains unknown');
  if (receipt.state === 'blocked') warnings.push('Control Room evidence is blocked');
  if (Date.parse(receipt.observedAt) > Date.parse(receipt.recordedAt)) {
    warnings.push('Observed timestamp is later than recorded timestamp');
  }

  return { valid: true, errors: [], warnings };
}

function collectEvidence(receipts) {
  const merged = new Map();

  receipts.forEach((receipt) => {
    const key = `${receipt.state}\u0000${receipt.statement.toLowerCase()}`;
    const current = merged.get(key) || {
      state: receipt.state,
      statement: receipt.statement,
      sourceRefs: [],
      receiptIds: [],
      kinds: [],
      observedFrom: receipt.observedAt,
      observedTo: receipt.observedAt,
    };

    merged.set(key, {
      ...current,
      sourceRefs: [...new Set([...current.sourceRefs, ...receipt.sourceRefs])],
      receiptIds: [...new Set([...current.receiptIds, receipt.id])],
      kinds: [...new Set([...current.kinds, receipt.kind])],
      observedFrom: Date.parse(receipt.observedAt) < Date.parse(current.observedFrom)
        ? receipt.observedAt
        : current.observedFrom,
      observedTo: Date.parse(receipt.observedAt) > Date.parse(current.observedTo)
        ? receipt.observedAt
        : current.observedTo,
    });
  });

  return [...merged.values()];
}

export function createControlRoomEvidenceIngestion(input, now = new Date()) {
  const receipts = Array.isArray(input?.receipts) ? input.receipts : [];

  if (receipts.length === 0) throw new Error('At least one Control Room evidence receipt is required');
  if (receipts.length > 200) throw new Error('Control Room ingestion accepts at most 200 receipts');

  receipts.forEach((receipt, index) => {
    const validation = validateControlRoomEvidenceReceipt(receipt);
    if (!validation.valid) {
      throw new Error(`Control Room receipt ${index + 1} is invalid: ${validation.errors.join('; ')}`);
    }
    if (receipt.status !== 'active') {
      throw new Error('Control Room ingestion accepts only active receipts');
    }
  });

  const receiptIds = receipts.map((receipt) => receipt.id);
  if (new Set(receiptIds).size !== receiptIds.length) {
    throw new Error('Control Room ingestion cannot count the same receipt more than once');
  }

  const workspaceIds = [...new Set(receipts.map((receipt) => receipt.workspaceId))];
  const projectIds = [...new Set(receipts.map((receipt) => receipt.projectId))];
  if (workspaceIds.length !== 1 || projectIds.length !== 1) {
    throw new Error('Control Room ingestion cannot mix receipts across workspaces or projects');
  }
  if (input?.workspaceId && input.workspaceId !== workspaceIds[0]) {
    throw new Error('Ingestion workspace does not match Control Room receipts');
  }
  if (input?.projectId && input.projectId !== projectIds[0]) {
    throw new Error('Ingestion project does not match Control Room receipts');
  }

  const evidence = collectEvidence(receipts);
  if (evidence.length > 50) {
    throw new Error('Control Room ingestion cannot preserve more than 50 unique evidence items; summarize before ingestion');
  }
  if (evidence.some((item) => item.sourceRefs.length > 20)) {
    throw new Error('Control Room evidence exceeds 20 source references; consolidate sources before ingestion');
  }
  if (evidence.some((item) => item.receiptIds.length > 20)) {
    throw new Error('Control Room evidence exceeds 20 contributing receipts; summarize receipts before ingestion');
  }

  const ingestion = {
    schemaVersion: CONTROL_ROOM_INGESTION_SCHEMA_VERSION,
    id: boundedText(input?.id, 180, 'Control Room ingestion id') || ingestionId(now, projectIds[0]),
    workspaceId: workspaceIds[0],
    projectId: projectIds[0],
    sourceSystem: 'founder-control-room',
    receiptIds,
    evidence,
    authority: authorityCopy(),
    createdAt: now.toISOString(),
  };

  const validation = validateControlRoomEvidenceIngestion(ingestion);
  if (!validation.valid) {
    throw new Error(`Control Room ingestion is invalid: ${validation.errors.join('; ')}`);
  }

  return ingestion;
}

export function validateControlRoomEvidenceIngestion(ingestion) {
  const errors = [];

  if (!ingestion || typeof ingestion !== 'object') {
    return { valid: false, errors: ['Control Room evidence ingestion must be an object'] };
  }

  if (ingestion.schemaVersion !== CONTROL_ROOM_INGESTION_SCHEMA_VERSION) errors.push('Unsupported schema version');
  if (!isBoundedText(ingestion.id, 180)) errors.push('Missing or invalid id');
  if (!isBoundedText(ingestion.workspaceId, 120)) errors.push('Missing or invalid workspace id');
  if (!isBoundedText(ingestion.projectId, 120)) errors.push('Missing or invalid project id');
  if (ingestion.sourceSystem !== 'founder-control-room') errors.push('Unsupported source system');
  if (!cleanIsoTimestamp(ingestion.createdAt)) errors.push('Invalid created timestamp');
  if (!authorityIsEvidenceOnly(ingestion.authority)) errors.push('Ingestion authority must remain evidence-only');

  if (!Array.isArray(ingestion.receiptIds) || ingestion.receiptIds.length === 0) {
    errors.push('Receipt ids must be a non-empty array');
  } else {
    if (new Set(ingestion.receiptIds).size !== ingestion.receiptIds.length) {
      errors.push('Receipt ids must be unique');
    }
    if (ingestion.receiptIds.some((receiptId) => !isBoundedText(receiptId, 180))) {
      errors.push('Receipt ids contain an invalid item');
    }
  }

  if (!Array.isArray(ingestion.evidence) || ingestion.evidence.length === 0 || ingestion.evidence.length > 50) {
    errors.push('Evidence must contain between 1 and 50 items');
  } else {
    ingestion.evidence.forEach((item, index) => {
      if (!EVIDENCE_STATE_SET.has(item?.state)) errors.push(`Evidence item ${index + 1} has an unsupported state`);
      if (!isBoundedText(item?.statement, 2000)) errors.push(`Evidence item ${index + 1} has a missing or invalid statement`);
      if (!Array.isArray(item?.sourceRefs) || item.sourceRefs.length > 20) {
        errors.push(`Evidence item ${index + 1} sourceRefs must contain at most 20 items`);
      } else {
        if (new Set(item.sourceRefs).size !== item.sourceRefs.length) {
          errors.push(`Evidence item ${index + 1} sourceRefs must be unique`);
        }
        if (item.sourceRefs.some((sourceRef) => !isBoundedText(sourceRef, 500))) {
          errors.push(`Evidence item ${index + 1} has an invalid source reference`);
        }
      }
      if (!Array.isArray(item?.receiptIds) || item.receiptIds.length === 0 || item.receiptIds.length > 20) {
        errors.push(`Evidence item ${index + 1} receiptIds must contain between 1 and 20 items`);
      } else {
        if (new Set(item.receiptIds).size !== item.receiptIds.length) {
          errors.push(`Evidence item ${index + 1} receiptIds must be unique`);
        }
        if (item.receiptIds.some((receiptId) => !isBoundedText(receiptId, 180))) {
          errors.push(`Evidence item ${index + 1} has an invalid receipt id`);
        }
        if (item.receiptIds.some((receiptId) => !ingestion.receiptIds?.includes(receiptId))) {
          errors.push(`Evidence item ${index + 1} references an unknown receipt id`);
        }
      }
      if (!Array.isArray(item?.kinds) || item.kinds.length === 0
        || item.kinds.some((kind) => !EVIDENCE_KIND_SET.has(kind))) {
        errors.push(`Evidence item ${index + 1} has invalid evidence kinds`);
      }
      const observedFrom = cleanIsoTimestamp(item?.observedFrom);
      const observedTo = cleanIsoTimestamp(item?.observedTo);
      if (!observedFrom || !observedTo) {
        errors.push(`Evidence item ${index + 1} has invalid observation timestamps`);
      } else if (Date.parse(observedFrom) > Date.parse(observedTo)) {
        errors.push(`Evidence item ${index + 1} observation range is reversed`);
      }
    });
  }

  if (Array.isArray(ingestion.evidence) && Array.isArray(ingestion.receiptIds)) {
    const evidenceReceiptIds = [...new Set(ingestion.evidence.flatMap((item) => item?.receiptIds || []))];
    if (evidenceReceiptIds.length !== ingestion.receiptIds.length
      || evidenceReceiptIds.some((receiptId) => !ingestion.receiptIds.includes(receiptId))) {
      errors.push('Receipt ids must exactly match evidence contributors');
    }
  }

  return { valid: errors.length === 0, errors };
}

export function createSpecialistReportFromControlRoomIngestion(input, now = new Date()) {
  const ingestion = input?.ingestion;
  const ingestionValidation = validateControlRoomEvidenceIngestion(ingestion);
  if (!ingestionValidation.valid) {
    throw new Error(`Control Room ingestion is invalid: ${ingestionValidation.errors.join('; ')}`);
  }
  if (input?.workspaceId && input.workspaceId !== ingestion.workspaceId) {
    throw new Error('Specialist workspace does not match Control Room ingestion');
  }
  if (input?.projectId && input.projectId !== ingestion.projectId) {
    throw new Error('Specialist project does not match Control Room ingestion');
  }

  const report = createSpecialistReport({
    id: input?.id,
    workspaceId: ingestion.workspaceId,
    projectId: ingestion.projectId,
    role: input?.role,
    domain: input?.domain,
    position: input?.position,
    conclusion: input?.conclusion,
    recommendation: input?.recommendation,
    reality: ingestion.evidence.map((item) => ({
      state: item.state,
      statement: item.statement,
      sourceRefs: item.sourceRefs,
      receiptIds: item.receiptIds,
    })),
    assumptions: input?.assumptions,
    confidence: input?.confidence,
    risks: input?.risks,
    dependencies: input?.dependencies,
    status: input?.status,
    source: `founder-control-room-ingestion:${ingestion.id}`,
    createdAt: input?.createdAt,
  }, now);

  const validation = validateSpecialistReport(report);
  if (!validation.valid) {
    throw new Error(`Specialist report from Control Room evidence is invalid: ${validation.errors.join('; ')}`);
  }

  return report;
}
