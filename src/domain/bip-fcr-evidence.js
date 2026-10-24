// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import {
  createControlRoomEvidenceIngestion,
  validateControlRoomEvidenceReceipt,
} from './control-room-evidence.js';

export const BIP_FCR_EVIDENCE_CONTRACT = 'juss/bip-fcr-chief-evidence@v1';
export const BIP_FCR_PROJECT_ID = 'sekret-bip';
export const BIP_FCR_WORKSPACE_ID = 'juss';
export const BIP_FCR_SUBJECT_TYPE = 'sekret-bip-control-room-proof';
export const BIP_REPOSITORY = 'jussray/Sekret-Bip';

const FULL_SHA = /^[0-9a-f]{40}$/i;

export function validateBipFounderControlRoomEvidence(receipt) {
  const base = validateControlRoomEvidenceReceipt(receipt);
  const errors = [...base.errors];

  if (!base.valid) return { valid: false, errors };
  if (receipt.workspaceId !== BIP_FCR_WORKSPACE_ID) errors.push('Bip evidence workspace mismatch');
  if (receipt.projectId !== BIP_FCR_PROJECT_ID) errors.push('Bip evidence project mismatch');
  if (receipt.sourceSystem !== 'founder-control-room') errors.push('Bip evidence must come from Founder Control Room');
  if (receipt.kind !== 'workflow') errors.push('Bip evidence kind must be workflow');
  if (receipt.subjectType !== BIP_FCR_SUBJECT_TYPE) errors.push('Bip evidence subject type mismatch');
  if (!FULL_SHA.test(receipt.sourceRevision)) errors.push('Bip evidence source revision must be an exact SHA');
  if (receipt.subjectId !== receipt.sourceRevision) errors.push('Bip evidence subject id must equal source revision');
  if (receipt.subjectRef !== `github:${BIP_REPOSITORY}@${receipt.sourceRevision}`) {
    errors.push('Bip evidence subject reference mismatch');
  }
  if (!receipt.sourceRefs.includes(`github:${BIP_REPOSITORY}@${receipt.sourceRevision}`)) {
    errors.push('Bip evidence must retain the exact repository reference');
  }
  if (!receipt.sourceRefs.some((ref) => ref.startsWith('juss-proof:'))) {
    errors.push('Bip evidence must retain the upstream juss-proof receipt reference');
  }

  return { valid: errors.length === 0, errors };
}

export function ingestBipFounderControlRoomEvidence(receipt, now = new Date()) {
  const validation = validateBipFounderControlRoomEvidence(receipt);
  if (!validation.valid) {
    throw new Error(`Bip Founder Control Room evidence is invalid: ${validation.errors.join('; ')}`);
  }

  const ingestion = createControlRoomEvidenceIngestion({
    workspaceId: BIP_FCR_WORKSPACE_ID,
    projectId: BIP_FCR_PROJECT_ID,
    receipts: [receipt],
  }, now);

  return {
    contract: BIP_FCR_EVIDENCE_CONTRACT,
    accepted: true,
    ingestion,
    authority: {
      scope: 'evidence-only',
      permitsExecution: false,
      permitsApproval: false,
      permitsDeployment: false,
      permitsPublishing: false,
    },
  };
}
