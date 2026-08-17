import { describe, expect, it } from 'vitest';
import {
  buildOperatorTruthSummary,
  classifyRuntimeWitness,
} from '../scripts/operator-truth-summary.mjs';

const baseLedger = {
  repository: 'jussray/chief-ai-machine',
  commitSha: '0123456789abcdef0123456789abcdef01234567',
  aggregate: {
    state: 'failed',
    counts: { warning: 0, failed: 1, queued: 0, running: 0, unknown: 0 },
  },
  checks: [],
};

describe('operator truth summary', () => {
  it('normalizes runtime witness classifications', () => {
    expect(classifyRuntimeWitness({ classification: 'runtime-non-json' })).toBe('runtime_non_json');
    expect(classifyRuntimeWitness({ classification: 'runtime-exact-sha' })).toBe('runtime_exact_sha');
  });

  it('prioritizes missing provider observability over secondary repository noise', () => {
    const summary = buildOperatorTruthSummary({
      ledger: {
        ...baseLedger,
        checks: [
          { name: 'Unit Tests', state: 'failed', conclusion: 'failure' },
          { name: 'Redacted provider receipt', state: 'failed', conclusion: 'failure' },
        ],
      },
    });

    expect(summary.primaryBlocker).toMatchObject({
      failureClass: 'provider_observability_missing',
      owner: 'provider-authority',
    });
    expect(summary.primaryBlocker.nextAction).toContain('read-only provider observability');
    expect(summary.repositoryChecksGreen).toBe(false);
    expect(summary.mergeRecommended).toBe(false);
  });

  it('makes runtime non-JSON a routing problem instead of a generic code failure', () => {
    const summary = buildOperatorTruthSummary({
      ledger: { ...baseLedger, aggregate: { ...baseLedger.aggregate, state: 'passed' } },
      runtimeWitness: {
        classification: 'runtime-non-json',
        status: 200,
        contentType: 'text/html',
      },
    });

    expect(summary.primaryBlocker).toMatchObject({
      failureClass: 'runtime_non_json',
      owner: 'runtime-routing',
    });
    expect(summary.primaryBlocker.nextAction).toContain('/version');
    expect(summary.repositoryChecksGreen).toBe(false);
    expect(summary.mergeRecommended).toBe(false);
  });

  it('treats a failed runtime proof check as runtime-unknown until its witness is inspected', () => {
    const summary = buildOperatorTruthSummary({
      ledger: {
        ...baseLedger,
        checks: [
          { name: 'Verify exact Chief runtime with Playwright', state: 'failed', conclusion: 'failure' },
        ],
      },
    });
    expect(summary.primaryBlocker).toMatchObject({
      failureClass: 'runtime_unknown',
      owner: 'runtime-routing',
    });
    expect(summary.primaryBlocker.nextAction).toContain('structured runtime witness');
  });

  it('counts a softened provider retry failure but keeps it nonblocking', () => {
    const summary = buildOperatorTruthSummary({
      ledger: {
        ...baseLedger,
        aggregate: {
          state: 'warning',
          counts: { warning: 1, failed: 0, queued: 0, running: 0, unknown: 0 },
        },
        checks: [
          {
            name: 'Workers Builds: chief-ai',
            state: 'failed',
            policyState: 'warning',
            conclusion: 'failure',
          },
        ],
      },
    });

    expect(summary.primaryBlocker).toBeNull();
    expect(summary.nonBlockingSignals).toEqual([
      expect.objectContaining({ failureClass: 'provider_build_failure', state: 'warning' }),
    ]);
    expect(summary.metrics.failureClassCounts.provider_build_failure).toBe(1);
    expect(summary.repositoryChecksGreen).toBe(false);
    expect(summary.mergeRecommended).toBe(false);
  });

  it('keeps merge authority fail-closed even when repository and runtime evidence are green', () => {
    const summary = buildOperatorTruthSummary({
      ledger: {
        ...baseLedger,
        aggregate: { state: 'passed', counts: { warning: 0, failed: 0, queued: 0, running: 0, unknown: 0 } },
      },
      runtimeWitness: { classification: 'runtime-exact-sha' },
    });

    expect(summary.primaryBlocker).toBeNull();
    expect(summary.repositoryChecksGreen).toBe(true);
    expect(summary.mergeRecommended).toBe(false);
    expect(summary.mergeAuthority).toMatchObject({
      evaluated: false,
      state: 'not_evaluated',
    });
    expect(summary.mergeAuthority.reason).toContain('independent review');
    expect(summary.mergeAuthority.reason).toContain('live merge-policy authority');
    expect(summary.publicClaimAuthorized).toBe(false);
  });
});
