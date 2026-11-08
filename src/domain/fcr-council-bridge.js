// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import {
  createSpecialistReportFromControlRoomIngestion,
  validateControlRoomEvidenceIngestion,
} from './control-room-evidence.js';
import {
  synthesizeExecutiveCouncil,
  validateExecutiveCouncilSynthesis,
} from './executive-council.js';
import { validateSpecialistReport } from './specialist-report.js';

export const FCR_COUNCIL_ROUND_CONTRACT = 'fcr.council-round.v1';
export const FCR_COUNCIL_SPECIALIST_CONTRIBUTION_CONTRACT = 'fcr.council-specialist-contribution.v1';

const POSITIONS = new Set(['support', 'conditional', 'oppose', 'abstain']);
const STATUSES = new Set(['draft', 'reviewed', 'approved']);
const FORBIDDEN_CONTRIBUTION_KEYS = new Set([
  'reality',
  'evidence',
  'evidenceRefs',
  'receiptIds',
  'authority',
  'approved',
  'merge',
  'deploy',
  'publish',
]);

function cleanText(value, maxLength = 10000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(value, maxItems = 30, maxLength = 2000) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => cleanText(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function validateContribution(contribution) {
  const errors = [];
  if (!contribution || typeof contribution !== 'object' || Array.isArray(contribution)) {
    return { valid: false, errors: ['Council specialist contribution must be an object'] };
  }

  for (const key of Object.keys(contribution)) {
    if (FORBIDDEN_CONTRIBUTION_KEYS.has(key)) {
      errors.push(`Council specialist contribution cannot carry ${key}`);
    }
  }

  if (contribution.contract !== FCR_COUNCIL_SPECIALIST_CONTRIBUTION_CONTRACT) {
    errors.push('Council specialist contribution contract mismatch');
  }
  if (!cleanText(contribution.role, 120)) errors.push('Council specialist contribution role is required');
  if (!cleanText(contribution.domain, 120)) errors.push('Council specialist contribution domain is required');
  if (!POSITIONS.has(contribution.position)) errors.push('Council specialist contribution position is unsupported');
  if (!cleanText(contribution.conclusion, 3000)) errors.push('Council specialist contribution conclusion is required');
  if (!cleanText(contribution.recommendation, 3000)) errors.push('Council specialist contribution recommendation is required');
  if (!Array.isArray(contribution.assumptions)) errors.push('Council specialist contribution assumptions must be an array');
  if (!Array.isArray(contribution.risks)) errors.push('Council specialist contribution risks must be an array');
  if (!Array.isArray(contribution.dependencies)) errors.push('Council specialist contribution dependencies must be an array');
  if (!Number.isInteger(contribution.confidence) || contribution.confidence < 0 || contribution.confidence > 100) {
    errors.push('Council specialist contribution confidence must be an integer from 0 to 100');
  }
  if (contribution.position === 'conditional'
    && Array.isArray(contribution.dependencies)
    && cleanStringList(contribution.dependencies).length === 0) {
    errors.push('Conditional Council specialist contributions require a dependency');
  }

  return { valid: errors.length === 0, errors };
}

function assertRoundBoundToIngestion(transcript, ingestion) {
  if (!transcript || typeof transcript !== 'object' || Array.isArray(transcript)) {
    throw new Error('FCR Council transcript must be an object');
  }
  if (transcript.contract !== FCR_COUNCIL_ROUND_CONTRACT) {
    throw new Error('FCR Council transcript contract mismatch');
  }
  if (transcript.state !== 'complete') {
    throw new Error('Only complete FCR Council rounds can enter Executive Council synthesis');
  }
  if (transcript.humanRelay !== false) {
    throw new Error('FCR Council report bridge requires zero-human-relay lineage');
  }
  const expectedSourceRef = `chief-ingestion:${ingestion.id}`;
  if (transcript.sourceRef !== expectedSourceRef) {
    throw new Error('FCR Council transcript is not bound to the supplied Chief ingestion');
  }
  if (!Array.isArray(transcript.hops) || transcript.hops.length === 0) {
    throw new Error('FCR Council transcript must contain completed specialist hops');
  }
}

function hopSource(ingestionId, hop) {
  const providerRefs = Array.isArray(hop.evidenceRefs)
    ? hop.evidenceRefs.filter((ref) => typeof ref === 'string' && ref.startsWith('provider:'))
    : [];
  const hash = cleanText(hop.responseHash, 64);
  const operator = cleanText(hop.toOperator, 80);
  return [
    `founder-control-room-ingestion:${ingestionId}`,
    `council-operator:${operator || 'unknown'}`,
    hash ? `response:${hash}` : '',
    ...providerRefs.slice(0, 3),
  ].filter(Boolean).join(';').slice(0, 500);
}

export function createSpecialistReportsFromFcrCouncil(input, now = new Date()) {
  const ingestion = input?.ingestion;
  const ingestionValidation = validateControlRoomEvidenceIngestion(ingestion);
  if (!ingestionValidation.valid) {
    throw new Error(`Control Room ingestion is invalid: ${ingestionValidation.errors.join('; ')}`);
  }

  const status = input?.status ?? 'draft';
  if (!STATUSES.has(status)) throw new Error('Council bridge status is unsupported');

  const transcript = input?.transcript;
  assertRoundBoundToIngestion(transcript, ingestion);

  const reports = transcript.hops.map((hop, index) => {
    if (!hop || typeof hop !== 'object' || hop.status !== 'completed' || hop.index !== index) {
      throw new Error(`FCR Council hop ${index + 1} is not a canonical completed hop`);
    }

    const contribution = hop.specialistContribution;
    const contributionValidation = validateContribution(contribution);
    if (!contributionValidation.valid) {
      throw new Error(
        `FCR Council hop ${index + 1} specialist contribution is invalid: ${contributionValidation.errors.join('; ')}`,
      );
    }

    const providerRefs = Array.isArray(hop.evidenceRefs)
      ? hop.evidenceRefs.filter((ref) => typeof ref === 'string' && ref.startsWith('provider:'))
      : [];
    const liveProviderEvidence = hop.liveProviderEvidence === true && providerRefs.length > 0;
    if ((status === 'reviewed' || status === 'approved') && !liveProviderEvidence) {
      throw new Error('Reviewed or approved Council reports require live provider evidence for every specialist hop');
    }

    const report = createSpecialistReportFromControlRoomIngestion({
      ingestion,
      role: cleanText(contribution.role, 120),
      domain: cleanText(contribution.domain, 120).toLowerCase(),
      position: contribution.position,
      conclusion: cleanText(contribution.conclusion, 3000),
      recommendation: cleanText(contribution.recommendation, 3000),
      assumptions: cleanStringList(contribution.assumptions),
      confidence: contribution.confidence,
      risks: cleanStringList(contribution.risks),
      dependencies: cleanStringList(contribution.dependencies),
      status,
    }, new Date(now.getTime() + index));

    report.source = hopSource(ingestion.id, hop);
    const reportValidation = validateSpecialistReport(report);
    if (!reportValidation.valid) {
      throw new Error(`Council-derived specialist report is invalid: ${reportValidation.errors.join('; ')}`);
    }
    return report;
  });

  const domains = reports.map((report) => report.domain);
  if (new Set(domains).size !== domains.length) {
    throw new Error('FCR Council bridge accepts only one specialist contribution per domain');
  }

  return reports;
}

export function synthesizeFcrCouncilRound(input, now = new Date()) {
  const reports = createSpecialistReportsFromFcrCouncil(input, now);
  const synthesis = synthesizeExecutiveCouncil({
    workspaceId: input?.ingestion?.workspaceId,
    projectId: input?.ingestion?.projectId,
    decision: input?.decision,
    nextGate: input?.nextGate,
    chiefRationale: input?.chiefRationale,
    reports,
    status: input?.status ?? 'draft',
  }, now);

  const validation = validateExecutiveCouncilSynthesis(synthesis);
  if (!validation.valid) {
    throw new Error(`Council bridge synthesis is invalid: ${validation.errors.join('; ')}`);
  }

  return { reports, synthesis };
}
