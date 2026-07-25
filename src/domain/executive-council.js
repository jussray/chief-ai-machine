// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import {
  createExecutiveBrief,
  EXECUTIVE_BRIEF_STATUSES,
  REALITY_STATES,
  validateExecutiveBrief,
} from './executive-brief.js';
import { validateSpecialistReport } from './specialist-report.js';

export const EXECUTIVE_COUNCIL_SCHEMA_VERSION = 1;

const POSITION_ORDER = Object.freeze(['support', 'conditional', 'oppose', 'abstain']);
const BRIEF_STATUS_SET = new Set(EXECUTIVE_BRIEF_STATUSES);
const REALITY_STATE_SET = new Set(REALITY_STATES);

function cleanText(value, maxLength = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function synthesisId(now, decision = '') {
  const seed = cleanText(decision, 80)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `council-${now.getTime()}-${seed || 'synthesis'}`;
}

function collectEvidence(reports) {
  const merged = new Map();

  reports.forEach((report) => {
    report.reality.forEach((item) => {
      const key = `${item.state}\u0000${item.statement.toLowerCase()}`;
      const current = merged.get(key) || {
        state: item.state,
        statement: item.statement,
        sourceRefs: [],
        receiptIds: [],
        reportIds: [],
      };

      merged.set(key, {
        ...current,
        sourceRefs: uniqueStrings([...current.sourceRefs, ...item.sourceRefs]),
        receiptIds: uniqueStrings([...current.receiptIds, ...(item.receiptIds || [])]),
        reportIds: uniqueStrings([...current.reportIds, report.id]),
      });
    });
  });

  return [...merged.values()];
}

function summarizePositions(reports) {
  return Object.fromEntries(POSITION_ORDER.map((position) => [
    position,
    reports.filter((report) => report.position === position).map((report) => report.role),
  ]));
}

function calculateConfidence(reports, evidence, positions) {
  const base = Math.round(reports.reduce((sum, report) => sum + report.confidence, 0) / reports.length);
  const lowestSpecialist = Math.min(...reports.map((report) => report.confidence));
  const caps = [{ reason: 'weakest-specialist', value: lowestSpecialist }];

  if (!evidence.some((item) => item.state === 'verified')) caps.push({ reason: 'no-verified-reality', value: 49 });
  if (evidence.some((item) => item.state === 'verified' && item.sourceRefs.length === 0)) {
    caps.push({ reason: 'unreferenced-verified-reality', value: 69 });
  }
  if (evidence.some((item) => item.state === 'blocked')) caps.push({ reason: 'blocked-reality', value: 69 });
  if (evidence.some((item) => item.state === 'unknown')) caps.push({ reason: 'unknown-reality', value: 79 });
  if (positions.conditional.length > 0) caps.push({ reason: 'conditional-position', value: 79 });
  if (positions.abstain.length > 0) caps.push({ reason: 'abstention', value: 69 });
  if (positions.oppose.length > 0) caps.push({ reason: 'opposition', value: 59 });

  const final = caps.reduce((confidence, cap) => Math.min(confidence, cap.value), base);
  return { base, lowestSpecialist, caps, final };
}

function buildRationale(reports, positions, chiefRationale) {
  const counts = POSITION_ORDER
    .map((position) => `${position}: ${positions[position].length}`)
    .join(', ');
  const conclusions = reports
    .map((report) => `[${report.role}] ${report.conclusion}`)
    .join(' ');
  const chief = cleanText(chiefRationale, 2000);

  return [
    `Executive Council synthesis across ${reports.length} specialist domain${reports.length === 1 ? '' : 's'} (${counts}).`,
    conclusions,
    chief,
  ].filter(Boolean).join(' ');
}

function buildDissent(reports) {
  return reports
    .filter((report) => report.position !== 'support')
    .map((report) => ({
      role: report.role,
      position: `${report.position}: ${report.recommendation}`,
      reason: report.conclusion,
    }));
}

function buildRisks(reports) {
  return uniqueStrings(reports.flatMap((report) => report.risks.map((risk) => `[${report.role}] ${risk}`)));
}

export function validateExecutiveCouncilSynthesis(synthesis) {
  const errors = [];

  if (!synthesis || typeof synthesis !== 'object') {
    return { valid: false, errors: ['Executive Council synthesis must be an object'] };
  }

  if (synthesis.schemaVersion !== EXECUTIVE_COUNCIL_SCHEMA_VERSION) errors.push('Unsupported schema version');
  if (!cleanText(synthesis.id, 180)) errors.push('Missing id');
  if (!cleanText(synthesis.workspaceId, 120)) errors.push('Missing workspace id');
  if (!cleanText(synthesis.projectId, 120)) errors.push('Missing project id');
  if (!cleanText(synthesis.createdAt, 40)) errors.push('Missing created timestamp');
  if (!Array.isArray(synthesis.reportIds) || synthesis.reportIds.length === 0) {
    errors.push('Report ids must be a non-empty array');
  } else if (new Set(synthesis.reportIds).size !== synthesis.reportIds.length) {
    errors.push('Report ids must be unique');
  }
  if (!Array.isArray(synthesis.domains) || synthesis.domains.length !== synthesis.reportIds?.length) {
    errors.push('Domains must align with report ids');
  }
  const synthesisReceiptIds = synthesis.receiptIds ?? [];
  if (synthesis.receiptIds !== undefined && !Array.isArray(synthesis.receiptIds)) {
    errors.push('Receipt ids must be an array');
  } else if (Array.isArray(synthesisReceiptIds)) {
    if (new Set(synthesisReceiptIds).size !== synthesisReceiptIds.length) {
      errors.push('Receipt ids must be unique');
    }
    if (synthesisReceiptIds.some((receiptId) => !cleanText(receiptId, 180) || receiptId.length > 180)) {
      errors.push('Receipt ids contain an invalid item');
    }
  }

  POSITION_ORDER.forEach((position) => {
    if (!Array.isArray(synthesis.positions?.[position])) errors.push(`Missing ${position} positions`);
  });

  if (!synthesis.confidence || typeof synthesis.confidence !== 'object') {
    errors.push('Missing confidence calculation');
  } else {
    ['base', 'lowestSpecialist', 'final'].forEach((field) => {
      const value = synthesis.confidence[field];
      if (!Number.isInteger(value) || value < 0 || value > 100) errors.push(`Invalid confidence ${field}`);
    });
    if (!Array.isArray(synthesis.confidence.caps)) {
      errors.push('Confidence caps must be an array');
    } else {
      synthesis.confidence.caps.forEach((cap, index) => {
        if (!cleanText(cap?.reason, 120)) errors.push(`Confidence cap ${index + 1} is missing a reason`);
        if (!Number.isInteger(cap?.value) || cap.value < 0 || cap.value > 100) {
          errors.push(`Confidence cap ${index + 1} has an invalid value`);
        }
      });
    }
  }

  if (!Array.isArray(synthesis.evidence) || synthesis.evidence.length === 0 || synthesis.evidence.length > 50) {
    errors.push('Evidence must contain between 1 and 50 items');
  } else {
    synthesis.evidence.forEach((item, index) => {
      if (!REALITY_STATE_SET.has(item?.state)) errors.push(`Evidence item ${index + 1} has an unsupported state`);
      if (!cleanText(item?.statement, 2000)) errors.push(`Evidence item ${index + 1} is missing a statement`);
      if (!Array.isArray(item?.sourceRefs) || item.sourceRefs.length > 20) {
        errors.push(`Evidence item ${index + 1} sourceRefs must contain at most 20 items`);
      }
      const receiptIds = item?.receiptIds ?? [];
      if (item?.receiptIds !== undefined && (!Array.isArray(receiptIds) || receiptIds.length > 20)) {
        errors.push(`Evidence item ${index + 1} receiptIds must contain at most 20 items`);
      } else if (Array.isArray(receiptIds)) {
        if (new Set(receiptIds).size !== receiptIds.length) {
          errors.push(`Evidence item ${index + 1} receiptIds must be unique`);
        }
        if (receiptIds.some((receiptId) => !cleanText(receiptId, 180) || receiptId.length > 180)) {
          errors.push(`Evidence item ${index + 1} has an invalid receipt id`);
        }
        if (receiptIds.some((receiptId) => !synthesisReceiptIds.includes(receiptId))) {
          errors.push(`Evidence item ${index + 1} references an unknown receipt id`);
        }
      }
      if (!Array.isArray(item?.reportIds) || item.reportIds.length === 0) {
        errors.push(`Evidence item ${index + 1} requires contributing report ids`);
      } else if (item.reportIds.some((reportId) => !synthesis.reportIds?.includes(reportId))) {
        errors.push(`Evidence item ${index + 1} references an unknown report id`);
      }
    });
  }

  if (Array.isArray(synthesis.evidence)) {
    const evidenceReceiptIds = uniqueStrings(synthesis.evidence.flatMap((item) => item?.receiptIds || []));
    if (evidenceReceiptIds.length > 0 && synthesis.receiptIds === undefined) {
      errors.push('Receipt ids are required when evidence references Control Room receipts');
    } else if (Array.isArray(synthesisReceiptIds)
      && (evidenceReceiptIds.length !== synthesisReceiptIds.length
        || evidenceReceiptIds.some((receiptId) => !synthesisReceiptIds.includes(receiptId)))) {
      errors.push('Receipt ids must exactly match evidence contributors');
    }
  }

  const briefValidation = validateExecutiveBrief(synthesis.brief);
  if (!briefValidation.valid) errors.push(...briefValidation.errors.map((error) => `Brief: ${error}`));
  if (synthesis.brief?.workspaceId !== synthesis.workspaceId) errors.push('Brief workspace does not match synthesis');
  if (synthesis.brief?.projectId !== synthesis.projectId) errors.push('Brief project does not match synthesis');

  return { valid: errors.length === 0, errors };
}

export function synthesizeExecutiveCouncil(input, now = new Date()) {
  const decision = cleanText(input?.decision, 2000);
  const nextGate = cleanText(input?.nextGate, 2000);
  const reports = Array.isArray(input?.reports) ? input.reports : [];

  if (!decision) throw new Error('Council decision is required');
  if (!nextGate) throw new Error('Council next gate is required');
  if (reports.length === 0) throw new Error('At least one specialist report is required');
  if (reports.length > 20) throw new Error('Executive Council accepts at most 20 specialist reports');

  reports.forEach((report, index) => {
    const validation = validateSpecialistReport(report);
    if (!validation.valid) {
      throw new Error(`Specialist report ${index + 1} is invalid: ${validation.errors.join('; ')}`);
    }
  });

  const reportIds = reports.map((report) => report.id);
  if (new Set(reportIds).size !== reportIds.length) {
    throw new Error('Executive Council cannot count the same specialist report more than once');
  }

  const domainKeys = reports.map((report) => report.domain.trim().toLowerCase());
  if (new Set(domainKeys).size !== domainKeys.length) {
    throw new Error('Executive Council accepts only one report per domain');
  }

  const workspaceIds = uniqueStrings(reports.map((report) => report.workspaceId));
  const projectIds = uniqueStrings(reports.map((report) => report.projectId));
  if (workspaceIds.length !== 1 || projectIds.length !== 1) {
    throw new Error('Executive Council cannot mix specialist reports across workspaces or projects');
  }
  if (input?.workspaceId && input.workspaceId !== workspaceIds[0]) {
    throw new Error('Council workspace does not match specialist reports');
  }
  if (input?.projectId && input.projectId !== projectIds[0]) {
    throw new Error('Council project does not match specialist reports');
  }

  const requestedStatus = input?.status || 'draft';
  if (!BRIEF_STATUS_SET.has(requestedStatus)) {
    throw new Error('Council status is unsupported');
  }
  if (reports.some((report) => report.status === 'superseded')) {
    throw new Error('Executive Council cannot use superseded specialist reports');
  }
  if (requestedStatus === 'reviewed'
    && reports.some((report) => report.status !== 'reviewed' && report.status !== 'approved')) {
    throw new Error('Reviewed council synthesis requires reviewed or approved specialist reports');
  }
  if (requestedStatus === 'approved' && reports.some((report) => report.status !== 'approved')) {
    throw new Error('Approved council synthesis requires approved specialist reports');
  }

  const evidence = collectEvidence(reports);
  if (evidence.length > 50) {
    throw new Error('Executive Council cannot synthesize more than 50 unique evidence items without an explicit summary');
  }
  if (evidence.some((item) => item.sourceRefs.length > 20)) {
    throw new Error('Executive Council evidence exceeds 20 source references; summarize sources before synthesis');
  }
  if (evidence.some((item) => item.receiptIds.length > 20)) {
    throw new Error('Executive Council evidence exceeds 20 Control Room receipts; summarize receipts before synthesis');
  }

  const positions = summarizePositions(reports);
  const confidence = calculateConfidence(reports, evidence, positions);
  const rationale = buildRationale(reports, positions, input?.chiefRationale);
  if (rationale.length > 5000) {
    throw new Error('Executive Council rationale exceeds Executive Brief capacity; summarize specialist conclusions first');
  }

  const risks = buildRisks(reports);
  if (risks.length > 30) {
    throw new Error('Executive Council cannot preserve more than 30 unique risks; consolidate risks before synthesis');
  }
  if (risks.some((risk) => risk.length > 2000)) {
    throw new Error('Executive Council attributed risk exceeds Executive Brief capacity; summarize the risk first');
  }

  const dissent = buildDissent(reports);
  if (dissent.some((item) => item.position.length > 1000 || item.reason.length > 2000)) {
    throw new Error('Executive Council dissent exceeds Executive Brief capacity; summarize the dissenting report first');
  }

  const id = synthesisId(now, decision);
  const receiptIds = uniqueStrings(evidence.flatMap((item) => item.receiptIds));
  const brief = createExecutiveBrief({
    workspaceId: workspaceIds[0],
    projectId: projectIds[0],
    decision,
    reality: evidence.map(({ state, statement, sourceRefs }) => ({ state, statement, sourceRefs })),
    rationale,
    dissent,
    confidence: confidence.final,
    risks,
    nextGate,
    status: requestedStatus,
    source: `executive-council:${id}`,
  }, now);

  const synthesis = {
    schemaVersion: EXECUTIVE_COUNCIL_SCHEMA_VERSION,
    id,
    workspaceId: workspaceIds[0],
    projectId: projectIds[0],
    reportIds,
    receiptIds,
    domains: reports.map((report) => report.domain),
    positions,
    confidence,
    evidence,
    brief,
    createdAt: now.toISOString(),
  };

  const validation = validateExecutiveCouncilSynthesis(synthesis);
  if (!validation.valid) {
    throw new Error(`Synthesized Executive Council record is invalid: ${validation.errors.join('; ')}`);
  }

  return synthesis;
}
