import { describe, expect, it } from 'vitest';
import {
  CONTROL_ROOM_EVIDENCE_AUTHORITY,
  assessControlRoomEvidenceReceipt,
  createControlRoomEvidenceIngestion,
  createControlRoomEvidenceReceipt,
  createSpecialistReportFromControlRoomIngestion,
  validateControlRoomEvidenceIngestion,
  validateControlRoomEvidenceReceipt,
} from './control-room-evidence.js';
import {
  synthesizeExecutiveCouncil,
  validateExecutiveCouncilSynthesis,
} from './executive-council.js';
import {
  createSpecialistReport,
  validateSpecialistReport,
} from './specialist-report.js';

const NOW = new Date('2026-07-24T05:00:00.000Z');

function receipt(overrides = {}, offset = 0) {
  return createControlRoomEvidenceReceipt({
    id: `receipt-${offset}`,
    workspaceId: 'juss',
    projectId: 'chief-ai-machine',
    sourceRecordId: `record-${offset}`,
    sourceRevision: 'sha-123',
    kind: 'workflow',
    subjectType: 'github-actions-run',
    subjectId: `run-${offset}`,
    subjectRef: 'main@sha-123',
    state: 'verified',
    statement: 'The focused domain tests passed.',
    sourceRefs: [`workflow-run:${offset}`],
    observedAt: new Date(NOW.getTime() - 1000 + offset).toISOString(),
    ...overrides,
  }, new Date(NOW.getTime() + offset));
}

describe('Founder Control Room evidence ingestion', () => {
  it('creates an evidence-only receipt and ignores attempted authority escalation', () => {
    const item = createControlRoomEvidenceReceipt({
      ...receipt({}, 1),
      id: 'receipt-authority',
      sourceRecordId: 'record-authority',
      authority: { permitsExecution: true },
    }, NOW);

    expect(item.authority).toEqual(CONTROL_ROOM_EVIDENCE_AUTHORITY);
    expect(validateControlRoomEvidenceReceipt(item)).toEqual({ valid: true, errors: [] });
  });

  it('rejects inference, missing proof, oversized fields, and forged authority', () => {
    expect(() => receipt({ state: 'inferred' }, 2)).toThrow('Control Room evidence state is unsupported');
    expect(() => receipt({ sourceRefs: [] }, 3)).toThrow('Verified Control Room evidence requires at least one source reference');
    expect(() => receipt({ statement: 'S'.repeat(2001) }, 4)).toThrow('Control Room evidence statement exceeds 2000 characters');
    expect(() => receipt({
      sourceRefs: Array.from({ length: 21 }, (_, index) => `source-${index}`),
    }, 5)).toThrow('Control Room source references exceeds 20 unique items');

    const forged = JSON.parse(JSON.stringify(receipt({}, 6)));
    forged.authority.permitsRoot = true;
    expect(validateControlRoomEvidenceReceipt(forged)).toEqual({
      valid: false,
      errors: ['Receipt authority must remain evidence-only'],
    });
  });

  it('keeps blocked and inactive evidence visible but refuses to ingest it', () => {
    const inactive = receipt({ state: 'blocked', status: 'superseded', sourceRefs: [] }, 7);
    expect(assessControlRoomEvidenceReceipt(inactive).warnings).toEqual([
      'Receipt is not active and must not be ingested',
      'Control Room evidence is blocked',
    ]);
    expect(() => createControlRoomEvidenceIngestion({ receipts: [inactive] }, NOW))
      .toThrow('Control Room ingestion accepts only active receipts');
  });

  it('merges matching claims while preserving source and receipt provenance', () => {
    const ingestion = createControlRoomEvidenceIngestion({
      receipts: [
        receipt({}, 8),
        receipt({ id: 'receipt-9', sourceRecordId: 'record-9', sourceRefs: ['workflow-run:9'] }, 9),
      ],
    }, NOW);

    expect(ingestion.evidence).toHaveLength(1);
    expect(ingestion.evidence[0].receiptIds).toEqual(['receipt-8', 'receipt-9']);
    expect(ingestion.evidence[0].sourceRefs).toEqual(['workflow-run:8', 'workflow-run:9']);
    expect(ingestion.authority.permitsExecution).toBe(false);
    expect(validateControlRoomEvidenceIngestion(ingestion)).toEqual({ valid: true, errors: [] });
  });

  it('rejects duplicate and cross-workspace receipts and fails closed on capacity', () => {
    const first = receipt({}, 10);
    expect(() => createControlRoomEvidenceIngestion({ receipts: [first, first] }, NOW))
      .toThrow('Control Room ingestion cannot count the same receipt more than once');

    expect(() => createControlRoomEvidenceIngestion({
      receipts: [
        receipt({}, 11),
        receipt({ id: 'other', sourceRecordId: 'other', workspaceId: 'other' }, 12),
      ],
    }, NOW)).toThrow('Control Room ingestion cannot mix receipts across workspaces or projects');

    const many = Array.from({ length: 51 }, (_, index) => receipt({
      id: `unique-${index}`,
      sourceRecordId: `unique-record-${index}`,
      statement: `Unique statement ${index}`,
    }, 100 + index));
    expect(() => createControlRoomEvidenceIngestion({ receipts: many }, NOW))
      .toThrow('Control Room ingestion cannot preserve more than 50 unique evidence items');
  });

  it('creates a reviewed specialist report without granting action authority', () => {
    const ingestion = createControlRoomEvidenceIngestion({ receipts: [receipt({}, 13)] }, NOW);
    const report = createSpecialistReportFromControlRoomIngestion({
      ingestion,
      role: 'Engineering Chief',
      domain: 'engineering',
      position: 'support',
      conclusion: 'The exact-head evidence supports the focused contract.',
      recommendation: 'Merge after review.',
      confidence: 94,
      risks: ['Hosted infrastructure may remain unavailable.'],
      status: 'reviewed',
    }, NOW);

    expect(report.reality[0].receiptIds).toEqual(['receipt-13']);
    expect(report.source).toBe(`founder-control-room-ingestion:${ingestion.id}`);
    expect(validateSpecialistReport(report)).toEqual({ valid: true, errors: [] });
  });

  it('rejects specialist boundary drift and reviewed reports built only from blocked evidence', () => {
    const ingestion = createControlRoomEvidenceIngestion({ receipts: [receipt({}, 14)] }, NOW);
    expect(() => createSpecialistReportFromControlRoomIngestion({
      ingestion,
      workspaceId: 'other',
      role: 'Engineering Chief',
      domain: 'engineering',
      position: 'support',
      conclusion: 'Conclusion.',
      recommendation: 'Recommendation.',
      confidence: 80,
    }, NOW)).toThrow('Specialist workspace does not match Control Room ingestion');

    const blocked = createControlRoomEvidenceIngestion({
      receipts: [receipt({ state: 'blocked', sourceRefs: [] }, 15)],
    }, NOW);
    expect(() => createSpecialistReportFromControlRoomIngestion({
      ingestion: blocked,
      role: 'Operations Chief',
      domain: 'operations',
      position: 'conditional',
      conclusion: 'Verification is blocked.',
      recommendation: 'Wait.',
      dependencies: ['Retrieve verification.'],
      confidence: 40,
      risks: ['Unknown runtime state.'],
      status: 'reviewed',
    }, NOW)).toThrow('Reviewed or approved specialist reports require at least one verified reality item');
  });

  it('preserves Control Room receipt ids through Executive Council synthesis', () => {
    const ingestion = createControlRoomEvidenceIngestion({ receipts: [receipt({}, 16)] }, NOW);
    const report = createSpecialistReportFromControlRoomIngestion({
      ingestion,
      id: 'engineering-report',
      role: 'Engineering Chief',
      domain: 'engineering',
      position: 'support',
      conclusion: 'The contract is focused.',
      recommendation: 'Merge.',
      confidence: 91,
      risks: ['Runtime integration remains separate.'],
      status: 'reviewed',
    }, NOW);
    const synthesis = synthesizeExecutiveCouncil({
      decision: 'Merge the Control Room ingestion contract.',
      reports: [report],
      nextGate: 'Build the runtime adapter separately.',
      status: 'reviewed',
    }, NOW);

    expect(synthesis.receiptIds).toEqual(['receipt-16']);
    expect(synthesis.evidence[0].receiptIds).toEqual(['receipt-16']);
    expect(validateExecutiveCouncilSynthesis(synthesis)).toEqual({ valid: true, errors: [] });
  });

  it('preserves schema-one reports and council records that predate receipt provenance', () => {
    const legacyReport = createSpecialistReport({
      id: 'legacy-report',
      workspaceId: 'juss',
      projectId: 'chief-ai-machine',
      role: 'Finance Chief',
      domain: 'finance',
      position: 'support',
      conclusion: 'No material cost is introduced.',
      recommendation: 'Proceed.',
      reality: [{ state: 'verified', statement: 'The slice has no paid dependency.', sourceRefs: ['package-diff'] }],
      confidence: 90,
      risks: ['Future runtime work may add cost.'],
      status: 'reviewed',
    }, NOW);
    delete legacyReport.reality[0].receiptIds;
    expect(validateSpecialistReport(legacyReport)).toEqual({ valid: true, errors: [] });

    const legacySynthesis = synthesizeExecutiveCouncil({
      decision: 'Proceed.',
      reports: [legacyReport],
      nextGate: 'Review runtime separately.',
      status: 'reviewed',
    }, NOW);
    delete legacySynthesis.receiptIds;
    legacySynthesis.evidence.forEach((item) => delete item.receiptIds);
    expect(validateExecutiveCouncilSynthesis(legacySynthesis)).toEqual({ valid: true, errors: [] });
  });
});
