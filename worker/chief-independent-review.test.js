import { describe, expect, it } from 'vitest';
import { createIndependentReview } from '../src/domain/independent-review.js';
import { handleChiefIndependentReview } from './chief-independent-review.js';

const BASE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const DIFF = '1'.repeat(64);
const POLICY = '2'.repeat(64);

function review(id, kind) {
  return createIndependentReview({
    repository: 'jussray/founder-control-room',
    pullRequestNumber: 364,
    baseSha: BASE,
    headSha: HEAD,
    diffHash: DIFF,
    policyHash: POLICY,
    reviewer: { id, kind, provider: kind === 'semantic' ? 'provider-neutral' : 'python', runtime: 'test-runtime' },
    authorIdentity: 'builder-agent',
    findings: [],
    summary: `${id} completed review.`,
  });
}

function request(body, method = 'POST') {
  return new Request('https://chief.example/api/chief/independent-review', {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Chief independent review proposal API', () => {
  it('returns a non-authorizing review bundle', async () => {
    const response = await handleChiefIndependentReview(request({
      reviews: [
        review('semantic-reviewer-1', 'semantic'),
        review('python-static-review-v1', 'deterministic'),
      ],
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.reviewBundle.semanticClearCandidate).toBe(true);
    expect(body.data.reviewBundle.mergeAuthorized).toBe(false);
    expect(body.data.reviewBundle.executionAuthorized).toBe(false);
    expect(body.data.governanceBoundary).toMatchObject({
      proposalOnly: true,
      mergeAuthorized: false,
      executionAuthorized: false,
      repositoryWitnessVerifiedByFcr: false,
      semanticProviderExecutedByThisRoute: false,
      pythonExecutedByThisRoute: false,
    });
  });

  it('does not promote Python-only input to semantic review', async () => {
    const response = await handleChiefIndependentReview(request({
      reviews: [review('python-static-review-v1', 'deterministic')],
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data.reviewBundle.semanticReviewPresent).toBe(false);
    expect(body.data.reviewBundle.semanticClearCandidate).toBe(false);
  });

  it('fails closed on malformed JSON and unsupported methods', async () => {
    const malformed = await handleChiefIndependentReview(new Request(
      'https://chief.example/api/chief/independent-review',
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' },
    ));
    expect(malformed.status).toBe(400);
    expect((await malformed.json()).error.code).toBe('invalid_json');

    const get = await handleChiefIndependentReview(request({}, 'GET'));
    expect(get.status).toBe(405);
    expect((await get.json()).error.code).toBe('method_not_allowed');
  });
});
