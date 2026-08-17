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
    expect(summary.mergeRecommended).toBe(false);
  });

  it('recommends merge only when the ledger is passed and there is no blocker', () => {
    const summary = buildOperatorTruthSummary({
      ledger: {
        ...baseLedger,
        aggregate: { state: 'passed', counts: { warning: 0, failed: 0, queued: 0, running: 0, unknown: 0 } },
      },
      runtimeWitness: { classification: 'runtime-exact-sha' },
    });
    expect(summary.primaryBlocker).toBeNull();
    expect(summary.mergeRecommended).toBe(true);
    expect(summary.publicClaimAuthorized).toBe(false);
  });
});
