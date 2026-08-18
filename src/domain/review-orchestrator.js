// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { sha256Hex } from './capability-plan.js';
import { validateIndependentReview } from './independent-review.js';

export const REVIEW_BUNDLE_CONTRACT = 'juss-v10/review-bundle@v1';

function cleanText(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizedIdentity(value) {
  return cleanText(value, 160).toLowerCase();
}

function bundleSeed(bundle) {
  return JSON.stringify([
    bundle.contract,
    bundle.repository,
    bundle.pullRequestNumber,
    bundle.baseSha,
    bundle.headSha,
    bundle.diffHash,
    bundle.policyHash,
    bundle.authorIdentity,
    bundle.reviewHashes,
    bundle.reviewerIds,
    bundle.semanticReviewerIds,
    bundle.deterministicReviewerIds,
    bundle.aggregateVerdict,
  ]);
}

export function reviewBundleHash(bundle) {
  return sha256Hex(bundleSeed(bundle));
}

function aggregateVerdict(reviews) {
  if (reviews.some((review) => review.verdict === 'blocked')) return 'blocked';
  if (reviews.some((review) => review.verdict === 'needs_review')) return 'needs_review';
  return 'clear';
}

export function createReviewBundle(input) {
  const reviews = Array.isArray(input?.reviews) ? [...input.reviews] : [];
  if (reviews.length === 0) throw new Error('At least one independent review is required');
  if (reviews.length > 12) throw new Error('Review bundle exceeds 12 reviewers');

  const validationErrors = reviews.flatMap((review, index) => {
    const validation = validateIndependentReview(review);
    return validation.valid ? [] : validation.errors.map((error) => `Review ${index + 1}: ${error}`);
  });
  if (validationErrors.length > 0) throw new Error(validationErrors.join('; '));

  const first = reviews[0];
  const contextFields = ['repository', 'pullRequestNumber', 'baseSha', 'headSha', 'diffHash', 'policyHash', 'authorIdentity'];
  for (const review of reviews.slice(1)) {
    for (const field of contextFields) {
      if (review[field] !== first[field]) throw new Error(`Review context mismatch: ${field}`);
    }
  }

  const reviewerIds = reviews.map((review) => cleanText(review.reviewer.id, 160));
  const normalizedReviewerIds = reviewerIds.map(normalizedIdentity);
  if (new Set(normalizedReviewerIds).size !== normalizedReviewerIds.length) {
    throw new Error('Duplicate reviewer identity in bundle');
  }

  const semanticReviewerIds = reviews
    .filter((review) => review.reviewer.kind === 'semantic')
    .map((review) => review.reviewer.id)
    .sort();
  const deterministicReviewerIds = reviews
    .filter((review) => review.reviewer.kind === 'deterministic')
    .map((review) => review.reviewer.id)
    .sort();
  const verdict = aggregateVerdict(reviews);

  const bundle = {
    contract: REVIEW_BUNDLE_CONTRACT,
    repository: first.repository,
    pullRequestNumber: first.pullRequestNumber,
    baseSha: first.baseSha,
    headSha: first.headSha,
    diffHash: first.diffHash,
    policyHash: first.policyHash,
    authorIdentity: first.authorIdentity,
    reviewHashes: reviews.map((review) => review.reviewHash).sort(),
    reviewerIds: [...reviewerIds].sort(),
    semanticReviewerIds,
    deterministicReviewerIds,
    aggregateVerdict: verdict,
    semanticReviewPresent: semanticReviewerIds.length > 0,
    semanticClearCandidate: semanticReviewerIds.length > 0 && verdict === 'clear',
    proposalOnly: true,
    mergeAuthorized: false,
    executionAuthorized: false,
  };

  return { ...bundle, bundleHash: reviewBundleHash(bundle) };
}
