import { assessCapabilityOutcome } from './capability-outcome.js';

const AUTHORITY = ['reason', 'draft', 'reversible', 'privileged'];
const AUTHORITY_RANK = new Map(AUTHORITY.map((value, index) => [value, index]));

function normalizeRequestedAuthority(value) {
  return AUTHORITY_RANK.has(value) ? value : 'reason';
}

/**
 * Consume a prior FCR outcome observation for the next Chief route.
 *
 * Feedback may only preserve or reduce the authority the caller requested.
 * A successful observation never grants broader authority and never promotes a
 * capability automatically. Invalid, unverified, failed, overridden, rolled
 * back, or incomplete outcomes fail closed to reasoning-only.
 */
export function applyCapabilityOutcomeFeedback(requestedAuthority, observation) {
  const requested = normalizeRequestedAuthority(requestedAuthority);

  if (!observation) {
    return {
      observed: false,
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
    requestedAuthority: requested,
    effectiveAuthority,
    recommendation: assessment.recommendation,
    promotionAllowed: false,
    founderReviewRequired: true,
    confidenceCap: assessment.confidenceCap,
    reasons: assessment.reasons,
  };
}
