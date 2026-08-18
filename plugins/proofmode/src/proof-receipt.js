export const FEDERATED_PROOF_CONTRACT = 'juss-proof/v1';

const RECEIPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const COMMIT_SHA = /^[0-9a-f]{40}$/i;

function normalizeReceiptId(value) {
  if (typeof value !== 'string' || !RECEIPT_ID.test(value)) {
    throw new Error('invalid_receipt_id');
  }
  return value.toLowerCase();
}

function normalizeAcknowledgements(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 50) throw new Error('invalid_acknowledgements');
  const receipts = value.map(normalizeReceiptId);
  if (new Set(receipts).size !== receipts.length) throw new Error('invalid_acknowledgements');
  return receipts;
}

function canonicalTimestamp(value) {
  const parsed = new Date(value);
  if (typeof value !== 'string' || Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new Error('invalid_issued_at');
  }
  return parsed.toISOString();
}

function receiptState(report) {
  if (report.readiness === 'repository_supported_runtime_unverified') return 'inferred';
  return 'unknown';
}

function layerState(state) {
  switch (state) {
    case 'supported':
      return 'verified';
    case 'partial':
      return 'inferred';
    case 'blocked':
      return 'blocked';
    case 'not_proven':
    default:
      return 'unknown';
  }
}

function layerEvidence(report) {
  if (!Array.isArray(report.layers)) return [];
  return report.layers
    .filter((layer) => layer && typeof layer === 'object' && typeof layer.layer === 'string')
    .slice(0, 20)
    .map((layer) => ({
      type: 'proofmode_layer',
      name: `${layer.layer}: ${typeof layer.state === 'string' ? layer.state : 'not_proven'}`,
      state: layerState(layer.state),
    }));
}

export function createProofModeReceipt(report, options = {}) {
  if (!report || typeof report !== 'object') throw new Error('invalid_report');
  if (typeof report.repository !== 'string' || !report.repository.includes('/')) {
    throw new Error('invalid_repository');
  }
  if (typeof report.headSha !== 'string' || !COMMIT_SHA.test(report.headSha)) {
    throw new Error('invalid_head_sha');
  }

  const receiptId = normalizeReceiptId(options.receiptId ?? crypto.randomUUID());
  const acknowledges = normalizeAcknowledgements(options.acknowledges);
  const issuedAt = canonicalTimestamp(options.issuedAt ?? new Date().toISOString());
  const runtimeStillUnverified =
    typeof report.readiness === 'string' && report.readiness.includes('runtime_unverified');

  return {
    schema: FEDERATED_PROOF_CONTRACT,
    receiptId,
    project: report.repository,
    actor: 'proofmode-github-mcp',
    authority: {
      provider: 'github',
      scope: 'repository',
      target: report.repository,
      mode: 'verify',
    },
    exactTarget: {
      repository: report.repository,
      ...(typeof report.ref === 'string' && report.ref ? { branch: report.ref } : {}),
      sha: report.headSha.toLowerCase(),
    },
    operation: 'repository_evidence_audit',
    state: receiptState(report),
    evidence: [
      {
        type: 'repository_snapshot',
        name: 'ProofMode GitHub repository evidence collected',
        state: 'verified',
        ...(typeof report.repositoryUrl === 'string' ? { ref: report.repositoryUrl } : {}),
      },
      ...layerEvidence(report),
    ],
    acknowledges,
    dependsOn: [...acknowledges],
    supersedes: [],
    ...(runtimeStillUnverified ? { nextAuthority: 'runtime-provider-mcp' } : {}),
    issuedAt,
  };
}
