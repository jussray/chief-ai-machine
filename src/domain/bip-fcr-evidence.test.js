import { describe, expect, it } from 'vitest';
import {
  BIP_FCR_EVIDENCE_CONTRACT,
  ingestBipFounderControlRoomEvidence,
  validateBipFounderControlRoomEvidence,
} from './bip-fcr-evidence.js';

const SHA = '579342699fc7fb394cf9684643756cdc8c9342a8';
const NOW = new Date('2026-09-23T04:11:00.000Z');

function receipt(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'bip-fcr-123e4567-e89b-42d3-a456-426614174000',
    workspaceId: 'juss',
    projectId: 'sekret-bip',
    sourceSystem: 'founder-control-room',
    sourceRecordId: '123e4567-e89b-42d3-a456-426614174000',
    sourceRevision: SHA,
    kind: 'workflow',
    subjectType: 'sekret-bip-control-room-proof',
    subjectId: SHA,
    subjectRef: `github:jussray/Sekret-Bip@${SHA}`,
    state: 'verified',
    statement: `Se’kret Bip Control Room exact-head test ledger is verified for ${SHA}.`,
    sourceRefs: [
      'juss-proof:123e4567-e89b-42d3-a456-426614174000',
      `github:jussray/Sekret-Bip@${SHA}`,
    ],
    status: 'active',
    supersedesReceiptId: '',
    observedAt: '2026-09-23T04:10:00.000Z',
    recordedAt: '2026-09-23T04:10:01.000Z',
    authority: {
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
    },
    ...overrides,
  };
}

describe('Bip FCR evidence recipient boundary', () => {
  it('accepts one exact FCR-issued Bip Control Room receipt as evidence-only input', () => {
    expect(validateBipFounderControlRoomEvidence(receipt())).toEqual({ valid: true, errors: [] });

    const result = ingestBipFounderControlRoomEvidence(receipt(), NOW);
    expect(result.contract).toBe(BIP_FCR_EVIDENCE_CONTRACT);
    expect(result.accepted).toBe(true);
    expect(result.ingestion.sourceSystem).toBe('founder-control-room');
    expect(result.ingestion.projectId).toBe('sekret-bip');
    expect(result.ingestion.receiptIds).toEqual(['bip-fcr-123e4567-e89b-42d3-a456-426614174000']);
    expect(result.authority.permitsExecution).toBe(false);
    expect(result.authority.permitsApproval).toBe(false);
  });

  it('rejects an audit mirror pretending to be FCR evidence', () => {
    const forged = receipt({ sourceSystem: 'sekret-bip-audit-mirror' });
    expect(validateBipFounderControlRoomEvidence(forged).valid).toBe(false);
    expect(() => ingestBipFounderControlRoomEvidence(forged, NOW)).toThrow();
  });

  it('rejects wrong repository identity and missing upstream receipt lineage', () => {
    expect(validateBipFounderControlRoomEvidence(receipt({
      subjectRef: `github:jussray/other@${SHA}`,
    })).errors).toContain('Bip evidence subject reference mismatch');

    expect(validateBipFounderControlRoomEvidence(receipt({
      sourceRefs: [`github:jussray/Sekret-Bip@${SHA}`],
    })).errors).toContain('Bip evidence must retain the upstream juss-proof receipt reference');
  });

  it('rejects any authority escalation', () => {
    const escalated = receipt({
      authority: {
        ...receipt().authority,
        permitsExecution: true,
      },
    });
    expect(validateBipFounderControlRoomEvidence(escalated).valid).toBe(false);
  });
});
