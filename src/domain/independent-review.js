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

function normalizeFindingsStrict(values) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new Error('Review findings must be an array');
  if (values.length > 100) throw new Error('Review findings exceed 100 items');

  const seen = new Set();
  return values.map((finding, index) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
      throw new Error(`Finding ${index + 1} must be an object`);
    }
    const id = cleanText(finding.id, 160);
    const severity = cleanText(finding.severity, 8).toUpperCase();
    const title = cleanText(finding.title, 500);
    const evidence = cleanText(finding.evidence, 3000);
    if (!id) throw new Error(`Finding ${index + 1} id is required`);
    if (seen.has(id)) throw new Error(`Duplicate finding id: ${id}`);
    seen.add(id);
    if (!SEVERITY_SET.has(severity)) throw new Error(`Finding ${index + 1} severity is unsupported`);
    if (!title) throw new Error(`Finding ${index + 1} title is required`);
    if (!evidence) throw new Error(`Finding ${index + 1} evidence is required`);
    if (finding.line !== undefined && finding.line !== null
      && (!Number.isInteger(finding.line) || finding.line <= 0)) {
      throw new Error(`Finding ${index + 1} line must be a positive integer or null`);
    }
    return {
      id,
      severity,
      title,
      path: cleanText(finding.path, 500),
      line: Number.isInteger(finding.line) && finding.line > 0 ? finding.line : null,
      evidence,
      recommendation: cleanText(finding.recommendation, 2000),
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
}

function reviewSeed(review) {
  const findings = Array.isArray(review?.findings) ? review.findings : [];
  return JSON.stringify([
    review?.contract,
    review?.repository,
    review?.pullRequestNumber,
    review?.baseSha,
    review?.headSha,
    review?.diffHash,
    review?.policyHash,
    review?.reviewer?.id,
    review?.reviewer?.kind,
    review?.reviewer?.provider,
    review?.reviewer?.runtime,
    review?.authorIdentity,
    findings.map((finding) => [
      finding?.id,
      finding?.severity,
      finding?.title,
      finding?.path,
      finding?.line,
      finding?.evidence,
      finding?.recommendation,
    ]),
    review?.verdict,
    review?.summary,
  ]);
}

export function independentReviewHash(review) {
  return sha256Hex(reviewSeed(review));
}

export function deriveReviewVerdict(findings) {
  if (!Array.isArray(findings)) throw new Error('Review findings must be an array');
  if (findings.some((finding) => finding?.severity === 'P0' || finding?.severity === 'P1')) return 'blocked';
  if (findings.some((finding) => finding?.severity === 'P2')) return 'needs_review';
  return 'clear';
}

export function createIndependentReview(input) {
  const findings = normalizeFindingsStrict(input?.findings);
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
  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    return { valid: false, errors: ['Review must be an object'] };
  }

  const repository = cleanText(review.repository, 240);
  if (review.contract !== INDEPENDENT_REVIEW_CONTRACT) errors.push('Unsupported independent review contract');
  if (!repository || !repository.includes('/')) errors.push('Repository must be owner/name');
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

  if (!Array.isArray(review.findings) || review.findings.length > 100) {
    errors.push('Findings must be an array of at most 100 items');
  } else {
    const ids = new Set();
    review.findings.forEach((finding, index) => {
      const id = cleanText(finding?.id, 160);
      if (!id) errors.push(`Finding ${index + 1} id is required`);
      if (id && ids.has(id)) errors.push(`Duplicate finding id: ${id}`);
      if (id) ids.add(id);
      if (!SEVERITY_SET.has(finding?.severity)) errors.push(`Finding ${index + 1} severity is unsupported`);
      if (!cleanText(finding?.title, 500)) errors.push(`Finding ${index + 1} title is required`);
      if (!cleanText(finding?.evidence, 3000)) errors.push(`Finding ${index + 1} evidence is required`);
      if (finding?.line !== undefined && finding?.line !== null
        && (!Number.isInteger(finding.line) || finding.line <= 0)) {
        errors.push(`Finding ${index + 1} line must be a positive integer or null`);
      }
    });
  }

  if (!VERDICT_SET.has(review.verdict)) errors.push('Unsupported review verdict');
  else if (Array.isArray(review.findings) && deriveReviewVerdict(review.findings) !== review.verdict) {
    errors.push('Review verdict does not match findings');
  }
  if (!cleanText(review.summary, 3000)) errors.push('Review summary is required');
  if (review.proposalOnly !== true || review.mergeAuthorized !== false || review.executionAuthorized !== false) {
    errors.push('Chief AI review output must remain proposal-only and non-authorizing');
  }
  if (!HASH.test(cleanText(review.reviewHash, 64))) errors.push('reviewHash must be sha256');
  else if (independentReviewHash(review) !== cleanText(review.reviewHash, 64).toLowerCase()) {
    errors.push('reviewHash does not match review content');
  }
  return { valid: errors.length === 0, errors };
}
