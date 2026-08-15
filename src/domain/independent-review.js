// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { sha256Hex } from './capability-plan.js';

export const INDEPENDENT_REVIEW_CONTRACT = 'juss-v10/independent-review@v1';
export const REVIEWER_KINDS = Object.freeze(['semantic', 'deterministic']);
export const REVIEW_SEVERITIES = Object.freeze(['P0', 'P1', 'P2', 'P3']);
export const REVIEW_VERDICTS = Object.freeze(['clear', 'needs_review', 'blocked']);

const KIND_SET = new Set(REVIEWER_KINDS);
const SEVERITY_SET = new Set(REVIEW_SEVERITIES);
const VERDICT_SET = new Set(REVIEW_VERDICTS);
const FULL_SHA = /^[0-9a-f]{40}$/i;
const HASH = /^[0-9a-f]{64}$/i;

function cleanText(value, maxLength = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanFindings(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  const findings = [];
  for (const finding of values.slice(0, 100)) {
    const id = cleanText(finding?.id, 160);
    const severity = cleanText(finding?.severity, 8).toUpperCase();
    const title = cleanText(finding?.title, 500);
    const evidence = cleanText(finding?.evidence, 3000);
    if (!id || !SEVERITY_SET.has(severity) || !title || !evidence || seen.has(id)) continue;
    seen.add(id);
    findings.push({
      id,
      severity,
      title,
      path: cleanText(finding?.path, 500),
      line: Number.isInteger(finding?.line) && finding.line > 0 ? finding.line : null,
      evidence,
      recommendation: cleanText(finding?.recommendation, 2000),
    });
  }
  return findings.sort((a, b) => a.id.localeCompare(b.id));
}

function reviewSeed(review) {
  return JSON.stringify([
    review.contract,
    review.repository,
    review.pullRequestNumber,
    review.baseSha,
    review.headSha,
    review.diffHash,
    review.policyHash,
    review.reviewer.id,
    review.reviewer.kind,
    review.reviewer.provider,
    review.reviewer.runtime,
    review.authorIdentity,
    review.findings.map((finding) => [
      finding.id,
      finding.severity,
      finding.title,
      finding.path,
      finding.line,
      finding.evidence,
      finding.recommendation,
    ]),
    review.verdict,
    review.summary,
  ]);
}

export function independentReviewHash(review) {
  return sha256Hex(reviewSeed(review));
}

export function deriveReviewVerdict(findings) {
  if (findings.some((finding) => finding.severity === 'P0' || finding.severity === 'P1')) return 'blocked';
  if (findings.some((finding) => finding.severity === 'P2')) return 'needs_review';
  return 'clear';
}

export function createIndependentReview(input) {
  const findings = cleanFindings(input?.findings);
  const verdict = deriveReviewVerdict(findings);
  const review = {
    contract: INDEPENDENT_REVIEW_CONTRACT,
    repository: cleanText(input?.repository, 240).toLowerCase(),
    pullRequestNumber: Number.isInteger(input?.pullRequestNumber) && input.pullRequestNumber > 0
      ? input.pullRequestNumber
      : 0,
    baseSha: cleanText(input?.baseSha, 40).toLowerCase(),
    headSha: cleanText(input?.headSha, 40).toLowerCase(),
    diffHash: cleanText(input?.diffHash, 64).toLowerCase(),
    policyHash: cleanText(input?.policyHash, 64).toLowerCase(),
    reviewer: {
      id: cleanText(input?.reviewer?.id, 160),
      kind: KIND_SET.has(input?.reviewer?.kind) ? input.reviewer.kind : '',
      provider: cleanText(input?.reviewer?.provider, 120),
      runtime: cleanText(input?.reviewer?.runtime, 160),
    },
    authorIdentity: cleanText(input?.authorIdentity, 160),
    findings,
    verdict,
    summary: cleanText(input?.summary, 3000),
    proposalOnly: true,
    mergeAuthorized: false,
    executionAuthorized: false,
  };

  const withHash = { ...review, reviewHash: independentReviewHash(review) };
  const validation = validateIndependentReview(withHash);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  return withHash;
}

export function validateIndependentReview(review) {
  const errors = [];
  if (!review || typeof review !== 'object') return { valid: false, errors: ['Review must be an object'] };
  if (review.contract !== INDEPENDENT_REVIEW_CONTRACT) errors.push('Unsupported independent review contract');
  if (!cleanText(review.repository, 240) || !review.repository.includes('/')) errors.push('Repository must be owner/name');
  if (!Number.isInteger(review.pullRequestNumber) || review.pullRequestNumber <= 0) errors.push('pullRequestNumber must be a positive integer');
  if (!FULL_SHA.test(cleanText(review.baseSha, 40))) errors.push('baseSha must be a full Git SHA');
  if (!FULL_SHA.test(cleanText(review.headSha, 40))) errors.push('headSha must be a full Git SHA');
  if (!HASH.test(cleanText(review.diffHash, 64))) errors.push('diffHash must be sha256');
  if (!HASH.test(cleanText(review.policyHash, 64))) errors.push('policyHash must be sha256');
  if (!cleanText(review.reviewer?.id, 160)) errors.push('Reviewer id is required');
  if (!KIND_SET.has(review.reviewer?.kind)) errors.push('Reviewer kind must be semantic or deterministic');
  if (!cleanText(review.reviewer?.provider, 120)) errors.push('Reviewer provider is required');
  if (!cleanText(review.reviewer?.runtime, 160)) errors.push('Reviewer runtime is required');
  if (!cleanText(review.authorIdentity, 160)) errors.push('Patch author identity is required');
  if (cleanText(review.reviewer?.id, 160).toLowerCase() === cleanText(review.authorIdentity, 160).toLowerCase()) {
    errors.push('Reviewer must be independent from the patch author identity');
  }
  if (!Array.isArray(review.findings) || review.findings.length > 100) errors.push('Findings must be an array of at most 100 items');
  else {
    const ids = new Set();
    review.findings.forEach((finding, index) => {
      if (!cleanText(finding?.id, 160)) errors.push(`Finding ${index + 1} id is required`);
      if (ids.has(finding?.id)) errors.push(`Duplicate finding id: ${finding?.id}`);
      ids.add(finding?.id);
      if (!SEVERITY_SET.has(finding?.severity)) errors.push(`Finding ${index + 1} severity is unsupported`);
      if (!cleanText(finding?.title, 500)) errors.push(`Finding ${index + 1} title is required`);
      if (!cleanText(finding?.evidence, 3000)) errors.push(`Finding ${index + 1} evidence is required`);
    });
  }
  if (!VERDICT_SET.has(review.verdict)) errors.push('Unsupported review verdict');
  else if (deriveReviewVerdict(review.findings ?? []) !== review.verdict) errors.push('Review verdict does not match findings');
  if (!cleanText(review.summary, 3000)) errors.push('Review summary is required');
  if (review.proposalOnly !== true || review.mergeAuthorized !== false || review.executionAuthorized !== false) {
    errors.push('Chief AI review output must remain proposal-only and non-authorizing');
  }
  if (!HASH.test(cleanText(review.reviewHash, 64))) errors.push('reviewHash must be sha256');
  else if (independentReviewHash(review) !== review.reviewHash.toLowerCase()) errors.push('reviewHash does not match review content');
  return { valid: errors.length === 0, errors };
}
