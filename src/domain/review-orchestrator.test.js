import { describe, expect, it } from 'vitest';
import { createIndependentReview } from './independent-review.js';
import { createReviewBundle } from './review-orchestrator.js';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const DIFF = '1'.repeat(64);
const POLICY = '2'.repeat(64);

function review(id, kind, findings = []) {
  return createIndependentReview({
    repository: 'jussray/founder-control-room',
    pullRequestNumber: 361,
    baseSha: BASE,
    headSha: HEAD,
    diffHash: DIFF,
    policyHash: POLICY,
    reviewer: { id, kind, provider: kind === 'semantic' ? 'provider-neutral' : 'python', runtime: 'test-runtime' },
    authorIdentity: 'builder-agent',
    findings,
    summary: `${id} completed review.`,
  });
}

describe('review orchestrator', () => {
  it('combines deterministic Python evidence with an independent semantic reviewer', () => {
    const bundle = createReviewBundle({
      reviews: [
        review('python-static-review-v1', 'deterministic'),
        review('semantic-reviewer-1', 'semantic'),
      ],
    });
    expect(bundle.aggregateVerdict).toBe('clear');
    expect(bundle.semanticReviewPresent).toBe(true);
    expect(bundle.semanticClearCandidate).toBe(true);
    expect(bundle.mergeAuthorized).toBe(false);
    expect(bundle.executionAuthorized).toBe(false);
  });

  it('does not let Python-only analysis masquerade as semantic review', () => {
    const bundle = createReviewBundle({ reviews: [review('python-static-review-v1', 'deterministic')] });
    expect(bundle.semanticReviewPresent).toBe(false);
    expect(bundle.semanticClearCandidate).toBe(false);
  });

  it('lets any P1 finding block the bundle', () => {
    const bundle = createReviewBundle({
      reviews: [
        review('semantic-reviewer-1', 'semantic'),
        review('python-static-review-v1', 'deterministic', [{
          id: 'python-p1',
          severity: 'P1',
          title: 'Risky shell execution',
          evidence: 'A shell execution primitive was added to the diff.',
          path: 'scripts/x.py',
          line: 10,
          recommendation: 'Use an argument vector and strict allowlist.',
        }]),
      ],
    });
    expect(bundle.aggregateVerdict).toBe('blocked');
    expect(bundle.semanticClearCandidate).toBe(false);
  });

  it('rejects reviewers that are bound to different heads', () => {
    const first = review('semantic-reviewer-1', 'semantic');
    const second = createIndependentReview({
      repository: first.repository,
      pullRequestNumber: first.pullRequestNumber,
      baseSha: first.baseSha,
      headSha: 'c'.repeat(40),
      diffHash: first.diffHash,
      policyHash: first.policyHash,
      reviewer: { id: 'python-static-review-v1', kind: 'deterministic', provider: 'python', runtime: 'test-runtime' },
      authorIdentity: first.authorIdentity,
      findings: [],
      summary: 'Different head.',
    });
    expect(() => createReviewBundle({ reviews: [first, second] })).toThrow(/headSha/);
  });

  it('rejects duplicate reviewer identities', () => {
    expect(() => createReviewBundle({
      reviews: [review('semantic-reviewer-1', 'semantic'), review('semantic-reviewer-1', 'semantic')],
    })).toThrow(/Duplicate reviewer identity/);
  });

  it('rejects case-variant duplicate reviewer identities', () => {
    expect(() => createReviewBundle({
      reviews: [review('Semantic-Reviewer-1', 'semantic'), review('semantic-reviewer-1', 'semantic')],
    })).toThrow(/Duplicate reviewer identity/);
  });
});
