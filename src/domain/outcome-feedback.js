import { assessCapabilityOutcome } from './capability-outcome.js';

const AUTHORITY = ['reason', 'draft', 'reversible', 'privileged'];
const AUTHORITY_RANK = new Map(AUTHORITY.map((value, index) => [value, index]));

function normalizeRequestedAuthority(value) {
  return AUTHORITY_RANK.has(value) ? value : 'reason';
}

/**
 * Consume a submitted prior outcome observation for the next Chief route.
 *
 * This boundary does not authenticate that the observation came from Founder
 * Control Room. Treat it as submitted/unverified provenance until FCR resolves
 * the exact execution/truth binding. Feedback may only preserve or reduce the
 * authority the caller requested, so untrusted input cannot raise authority.
 */
export function applyCapabilityOutcomeFeedback(requestedAuthority, observation) {
  const requested = normalizeRequestedAuthority(requestedAuthority);

  if (!observation) {
    return {
      observed: false,
      sourceTrust: 'none',
      requestedAuthority: requested,
      effectiveAuthority: requested,
      recommendation: 'none',
      promotionAllowed: false,
      founderReviewRequired: true,
      confidenceCap: null,
      reasons: ['No prior outcome observation was submitted.'],
    };
  }

  const assessment = assessCapabilityOutcome(observation);
  const keepRequested = assessment.valid && assessment.recommendation === 'candidate-promote';
  const effectiveAuthority = keepRequested ? requested : 'reason';

  return {
    observed: true,
    sourceTrust: 'submitted-unverified',
    requestedAuthority: requested,
    effectiveAuthority,
    recommendation: assessment.recommendation,
    promotionAllowed: false,
    founderReviewRequired: true,
    confidenceCap: assessment.confidenceCap,
    reasons: assessment.reasons,
  };
}
