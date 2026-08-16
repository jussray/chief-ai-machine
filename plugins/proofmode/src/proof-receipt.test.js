import { describe, expect, it } from 'vitest';
import { createProofModeReceipt } from './proof-receipt.js';

const SHA = '0123456789abcdef0123456789abcdef01234567';
const RECEIPT = '11111111-1111-4111-8111-111111111111';
const UPSTREAM = '22222222-2222-4222-8222-222222222222';
const NOW = '2026-08-16T08:52:00.000Z';

function report(overrides = {}) {
  return {
    repository: 'jussray/chief-ai-machine',
    repositoryUrl: 'https://github.com/jussray/chief-ai-machine',
    ref: 'main',
    headSha: SHA,
    readiness: 'repository_supported_runtime_unverified',
    layers: [],
    nextChecks: [],
    limitations: [],
    ...overrides,
  };
}

describe('ProofMode federation receipt', () => {
  it('binds repository evidence to one exact SHA and upstream lineage', () => {
    const receipt = createProofModeReceipt(report(), {
      receiptId: RECEIPT,
      acknowledges: [UPSTREAM],
      issuedAt: NOW,
    });

    expect(receipt).toMatchObject({
      schema: 'juss-proof/v1',
      receiptId: RECEIPT,
      project: 'jussray/chief-ai-machine',
      actor: 'proofmode-github-mcp',
      authority: {
        provider: 'github',
        scope: 'repository',
        target: 'jussray/chief-ai-machine',
        mode: 'verify',
      },
      exactTarget: {
        repository: 'jussray/chief-ai-machine',
        branch: 'main',
        sha: SHA,
      },
      operation: 'repository_evidence_audit',
      state: 'verified',
      acknowledges: [UPSTREAM],
      dependsOn: [UPSTREAM],
      supersedes: [],
      nextAuthority: 'runtime-provider-mcp',
      issuedAt: NOW,
    });
  });

  it('fails closed on malformed exact-SHA or receipt lineage input', () => {
    expect(() =>
      createProofModeReceipt(report({ headSha: 'main' }), {
        receiptId: RECEIPT,
        issuedAt: NOW,
      }),
    ).toThrow('invalid_head_sha');

    expect(() =>
      createProofModeReceipt(report(), {
        receiptId: RECEIPT,
        acknowledges: ['not-a-receipt'],
        issuedAt: NOW,
      }),
    ).toThrow('invalid_receipt_id');
  });
});
