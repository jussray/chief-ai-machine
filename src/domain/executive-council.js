// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import {
  createExecutiveBrief,
  EXECUTIVE_BRIEF_STATUSES,
  validateExecutiveBrief,
} from './executive-brief.js';
import { validateSpecialistReport } from './specialist-report.js';

export const EXECUTIVE_COUNCIL_SCHEMA_VERSION = 1;

const POSITION_ORDER = Object.freeze(['support', 'conditional', 'oppose', 'abstain']);
const BRIEF_STATUS_SET = new Set(EXECUTIVE_BRIEF_STATUSES);

function cleanText(value, maxLength = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function uniqueStrings(values, maxItems = 50) {
  return [...new Set(values.filter(Boolean))].slice(0, maxItems);
}

function mergeReality(reports) {
  const merged = new Map();

  reports.forEach((report) => {
    report.reality.forEach((item) => {
      const key = `${item.state}\u0000${item.statement.toLowerCase()}`;
      const sourceRefs = uniqueStrings([
        ...item.sourceRefs,
        `specialist-report:${report.id}`,
      ], 20);

      if (!merged.has(key)) {
        merged.set(key, { ...item, sourceRefs });
        return;
      }

      const current = merged.get(key);
      merged.set(key, {
        ...current,
        sourceRefs: uniqueStrings([...current.sourceRefs, ...sourceRefs], 20),
      });
    });
  });

  return [...merged.values()].slice(0, 50);
}

function summarizePositions(reports) {
  return Object.fromEntries(POSITION_ORDER.map((position) => [
    position,
    reports.filter((report) => report.position === position).map((report) => report.role),
  ]));
}

function calculateConfidence(reports, reality, positions) {
  const base = Math.round(reports.reduce((sum, report) => sum + report.confidence, 0) / reports.length);
  const lowestSpecialist = Math.min(...reports.map((report) => report.confidence));
  const caps = [{ reason: 'weakest-specialist', value: lowestSpecialist }];

  if (!reality.some((item) => item.state === 'verified')) caps.push({ reason: 'no-verified-reality', value: 49 });
  if (reality.some((item) => item.state === 'verified'
    && !item.sourceRefs.some((sourceRef) => !sourceRef.startsWith('specialist-report:')))) {
    caps.push({ reason: 'unreferenced-verified-reality', value: 69 });
  }
  if (reality.some((item) => item.state === 'blocked')) caps.push({ reason: 'blocked-reality', value: 69 });
  if (reality.some((item) => item.state === 'unknown')) caps.push({ reason: 'unknown-reality', value: 79 });
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
  return uniqueStrings(reports.flatMap((report) => report.risks.map((risk) => `[${report.role}] ${risk}`)), 30);
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

  const reality = mergeReality(reports);
  const positions = summarizePositions(reports);
  const confidence = calculateConfidence(reports, reality, positions);
  const brief = createExecutiveBrief({
    workspaceId: workspaceIds[0],
    projectId: projectIds[0],
    decision,
    reality,
    rationale: buildRationale(reports, positions, input?.chiefRationale),
    dissent: buildDissent(reports),
    confidence: confidence.final,
    risks: buildRisks(reports),
    nextGate,
    status: requestedStatus,
    source: `executive-council:${reports.map((report) => report.id).join(',')}`,
  }, now);

  const validation = validateExecutiveBrief(brief);
  if (!validation.valid) {
    throw new Error(`Synthesized executive brief is invalid: ${validation.errors.join('; ')}`);
  }

  return {
    schemaVersion: EXECUTIVE_COUNCIL_SCHEMA_VERSION,
    reportIds,
    domains: reports.map((report) => report.domain),
    positions,
    confidence,
    brief,
  };
}
