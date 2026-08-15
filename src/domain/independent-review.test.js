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

  it('fails closed instead of silently dropping a malformed P1 finding', () => {
    expect(() => createIndependentReview(base({
      findings: [{
        id: 'p1-malformed',
        severity: 'P1',
        title: '',
        evidence: 'A provider supplied a blocking finding with a missing title.',
      }],
    }))).toThrow(/title is required/);
  });

  it('refuses duplicate finding ids instead of de-duplicating away evidence', () => {
    const finding = {
      id: 'same-id',
      severity: 'P1',
      title: 'Duplicate identity',
      evidence: 'Two provider findings reused one id.',
    };
    expect(() => createIndependentReview(base({ findings: [finding, finding] }))).toThrow(/Duplicate finding id/);
  });

  it('returns invalid rather than throwing on malformed deserialized review fields', () => {
    const malformed = {
      contract: INDEPENDENT_REVIEW_CONTRACT,
      repository: null,
      pullRequestNumber: '361',
      reviewer: null,
      findings: 'not-an-array',
      verdict: 'clear',
      reviewHash: 'not-a-hash',
    };
    expect(() => validateIndependentReview(malformed)).not.toThrow();
    expect(validateIndependentReview(malformed).valid).toBe(false);
  });
});
