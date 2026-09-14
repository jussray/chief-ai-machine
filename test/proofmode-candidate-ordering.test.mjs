import { describe, expect, it } from 'vitest';
import { evaluateCandidateProducerEvidence } from '../scripts/verify-candidate-producer-evidence.mjs';

const HEAD = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CONTEXT = 'Verify candidate ProofMode runtime with Playwright';
const EXTERNAL_APP_ID = 424242;
const semantics = {
  preMergeCandidateContext: CONTEXT,
  preMergeCandidateIntegrationId: EXTERNAL_APP_ID,
  preMergeCandidateProducerTrust: 'external-github-app-check-required',
  preMergeCandidateWorkflowProvenance: 'must-not-be-pr-authored-github-actions-only',
  preMergeCandidateProducerEvidence: 'exact-head-check-run-app-identity-required',
};

function check({ id, conclusion }) {
  return {
    id,
    name: CONTEXT,
    head_sha: HEAD,
    status: 'completed',
    conclusion,
    started_at: '2026-09-05T20:00:00Z',
    app: { id: EXTERNAL_APP_ID, slug: 'chief-proof-witness' },
  };
}

describe('candidate producer run ordering', () => {
  it('does not use check id as a semantic clock when duplicate runs share started_at', () => {
    const result = evaluateCandidateProducerEvidence({
      checks: [
        check({ id: 40, conclusion: 'success' }),
        check({ id: 41, conclusion: 'failure' }),
      ],
      semantics,
      expectedHeadSha: HEAD,
    });

    expect(result.ok).toBe(false);
    expect(result.currentConfiguredCheckId).toBeNull();
    expect(result.successfulConfiguredCheckIds).toEqual([]);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-check-order-ambiguous',
        checkIds: [40, 41],
      }),
      expect.objectContaining({ classification: 'candidate-check-not-successful' }),
    ]));
  });
});
