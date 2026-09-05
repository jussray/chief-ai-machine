import { describe, expect, it } from 'vitest';
import { evaluateCandidateProducerEvidence } from '../scripts/verify-candidate-producer-evidence.mjs';

const HEAD = 'be08fb632e45290d59128a385eee740ab86d7737';
const CONTEXT = 'Verify candidate ProofMode runtime with Playwright';
const EXTERNAL_APP_ID = 424242;
const ACTIONS_APP_ID = 15368;

const semantics = {
  preMergeCandidateContext: CONTEXT,
  preMergeCandidateIntegrationId: EXTERNAL_APP_ID,
  preMergeCandidateProducerTrust: 'external-github-app-check-required',
  preMergeCandidateWorkflowProvenance: 'must-not-be-pr-authored-github-actions-only',
  preMergeCandidateProducerEvidence: 'exact-head-check-run-app-identity-required',
};

function check({
  id = 1,
  headSha = HEAD,
  appId = EXTERNAL_APP_ID,
  appSlug = 'chief-proof-witness',
  status = 'completed',
  conclusion = 'success',
  startedAt = '2026-09-05T20:00:00Z',
} = {}) {
  return {
    id,
    name: CONTEXT,
    head_sha: headSha,
    status,
    conclusion,
    started_at: startedAt,
    app: { id: appId, slug: appSlug },
  };
}

describe('candidate producer evidence', () => {
  it('accepts exact-head success only from the configured external GitHub App', () => {
    const result = evaluateCandidateProducerEvidence({
      checks: [check()],
      semantics,
      expectedHeadSha: HEAD,
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.observedProducerIds).toEqual([EXTERNAL_APP_ID]);
    expect(result.currentConfiguredCheckId).toBe(1);
    expect(result.successfulConfiguredCheckIds).toEqual([1]);
  });

  it('fails closed when the configured producer is GitHub Actions', () => {
    const result = evaluateCandidateProducerEvidence({
      checks: [check({ appId: ACTIONS_APP_ID, appSlug: 'github-actions' })],
      semantics: { ...semantics, preMergeCandidateIntegrationId: ACTIONS_APP_ID },
      expectedHeadSha: HEAD,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: 'candidate-producer-github-actions-forbidden' }),
      expect.objectContaining({ classification: 'candidate-context-emitted-by-github-actions' }),
    ]));
  });

  it('fails closed when the candidate context is emitted by competing app identities', () => {
    const result = evaluateCandidateProducerEvidence({
      checks: [
        check({ id: 1 }),
        check({ id: 2, appId: ACTIONS_APP_ID, appSlug: 'github-actions' }),
      ],
      semantics,
      expectedHeadSha: HEAD,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: 'candidate-check-producer-ambiguous' }),
      expect.objectContaining({ classification: 'candidate-context-emitted-by-github-actions' }),
    ]));
  });

  it('does not let an older success mask a newer failed run from the same producer', () => {
    const result = evaluateCandidateProducerEvidence({
      checks: [
        check({ id: 10, startedAt: '2026-09-05T20:00:00Z' }),
        check({
          id: 11,
          startedAt: '2026-09-05T20:05:00Z',
          status: 'completed',
          conclusion: 'failure',
        }),
      ],
      semantics,
      expectedHeadSha: HEAD,
    });

    expect(result.ok).toBe(false);
    expect(result.currentConfiguredCheckId).toBe(11);
    expect(result.successfulConfiguredCheckIds).toEqual([]);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-check-not-successful',
        current: expect.objectContaining({ id: 11, conclusion: 'failure' }),
      }),
    ]));
  });

  it('does not let an older success mask a newer in-progress rerun', () => {
    const result = evaluateCandidateProducerEvidence({
      checks: [
        check({ id: 20, startedAt: '2026-09-05T20:00:00Z' }),
        check({
          id: 21,
          startedAt: '2026-09-05T20:06:00Z',
          status: 'in_progress',
          conclusion: '',
        }),
      ],
      semantics,
      expectedHeadSha: HEAD,
    });

    expect(result.ok).toBe(false);
    expect(result.currentConfiguredCheckId).toBe(21);
    expect(result.successfulConfiguredCheckIds).toEqual([]);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-check-not-successful',
        current: expect.objectContaining({ id: 21, status: 'in_progress' }),
      }),
    ]));
  });

  it('does not inherit a successful producer check from another commit', () => {
    const result = evaluateCandidateProducerEvidence({
      checks: [check({ headSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' })],
      semantics,
      expectedHeadSha: HEAD,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: 'candidate-check-not-observed' }),
    ]));
  });

  it('requires machine-readable observed-evidence semantics', () => {
    const result = evaluateCandidateProducerEvidence({
      checks: [check()],
      semantics: { ...semantics, preMergeCandidateProducerEvidence: undefined },
      expectedHeadSha: HEAD,
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: 'candidate-producer-contract-incomplete' }),
    ]));
  });
});
