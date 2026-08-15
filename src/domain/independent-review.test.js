import { describe, expect, it } from 'vitest';
import {
  createIndependentReview,
  deriveReviewVerdict,
  validateIndependentReview,
} from './independent-review.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const HASH_A = '1'.repeat(64);
const HASH_B = '2'.repeat(64);

function base(overrides = {}) {
  return {
    repository: 'jussray/founder-control-room',
    pullRequestNumber: 361,
    baseSha: SHA_A,
    headSha: SHA_B,
    diffHash: HASH_A,
    policyHash: HASH_B,
    reviewer: {
      id: 'chief-review-semantic-1',
      kind: 'semantic',
      provider: 'provider-neutral',
      runtime: 'chief-ai-machine',
    },
    authorIdentity: 'builder-agent-1',
    findings: [],
    summary: 'No merge-blocking finding was identified in the submitted review scope.',
    ...overrides,
  };
}

describe('independent review contract', () => {
  it('creates a proposal-only exact-head review with deterministic hash', () => {
    const review = createIndependentReview(base());
    expect(review.verdict).toBe('clear');
    expect(review.proposalOnly).toBe(true);
    expect(review.mergeAuthorized).toBe(false);
    expect(review.executionAuthorized).toBe(false);
    expect(review.reviewHash).toMatch(/^[0-9a-f]{64}$/);
    expect(validateIndependentReview(review)).toEqual({ valid: true, errors: [] });
  });

  it('blocks P0/P1 and requires human review for P2', () => {
    expect(deriveReviewVerdict([{ severity: 'P1' }])).toBe('blocked');
    expect(deriveReviewVerdict([{ severity: 'P2' }])).toBe('needs_review');
    expect(deriveReviewVerdict([{ severity: 'P3' }])).toBe('clear');
  });

  it('refuses self-review', () => {
    expect(() => createIndependentReview(base({
      reviewer: {
        id: 'builder-agent-1',
        kind: 'semantic',
        provider: 'provider-neutral',
        runtime: 'chief-ai-machine',
      },
    }))).toThrow(/independent/i);
  });

  it('refuses content tampering after the review hash is created', () => {
    const review = createIndependentReview(base());
    const tampered = { ...review, headSha: 'c'.repeat(40) };
    expect(validateIndependentReview(tampered).valid).toBe(false);
    expect(validateIndependentReview(tampered).errors.join(' ')).toMatch(/hash/i);
  });

  it('derives the verdict instead of trusting caller-supplied optimism', () => {
    const review = createIndependentReview(base({
      findings: [{
        id: 'p1-auth-bypass',
        severity: 'P1',
        title: 'Authorization can be bypassed',
        evidence: 'The submitted diff exposes a privileged path without the existing authority gate.',
        path: 'src/example.js',
        line: 42,
        recommendation: 'Route the operation through the existing authority adapter.',
      }],
      verdict: 'clear',
    }));
    expect(review.verdict).toBe('blocked');
  });
});
