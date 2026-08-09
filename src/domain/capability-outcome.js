// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const OUTCOME_OBSERVATION_CONTRACT = 'juss-v10/outcome-observation@v1';

const HASH = /^[0-9a-f]{64}$/i;
const RECEIPT = /^fcr-conveyor-receipt-v3:[0-9a-f]{64}$/i;

function cleanText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

export function validateCapabilityOutcomeObservation(observation) {
  const errors = [];
  if (!observation || typeof observation !== 'object') return { valid: false, errors: ['Outcome observation must be an object'] };
  if (observation.contract !== OUTCOME_OBSERVATION_CONTRACT) errors.push('Unsupported outcome observation contract');
  if (!HASH.test(cleanText(observation.capabilityPlanHash, 64))) errors.push('capabilityPlanHash must be sha256');
  if (!RECEIPT.test(cleanText(observation.executionReceiptId, 120))) errors.push('executionReceiptId must be a V3 conveyor receipt');
  if (typeof observation.verified !== 'boolean') errors.push('verified must be boolean');
  if (observation.goalSucceeded !== null && typeof observation.goalSucceeded !== 'boolean') errors.push('goalSucceeded must be boolean or null');
  if (typeof observation.founderOverride !== 'boolean') errors.push('founderOverride must be boolean');
  if (typeof observation.rollbackUsed !== 'boolean') errors.push('rollbackUsed must be boolean');
  if (!Number.isInteger(observation.evidenceCompleteness) || observation.evidenceCompleteness < 0 || observation.evidenceCompleteness > 100) {
    errors.push('evidenceCompleteness must be an integer from 0 to 100');
  }
  if (!Array.isArray(observation.outcomeSignals) || observation.outcomeSignals.length === 0) errors.push('Outcome signals are required');
  if (!Array.isArray(observation.evidenceUrls)) errors.push('Evidence URLs must be an array');
  if (observation.verified && (!Array.isArray(observation.evidenceUrls) || observation.evidenceUrls.length === 0)) {
    errors.push('Verified outcomes require evidence URLs');
  }
  if (observation.goalSucceeded === true && observation.verified !== true) {
    errors.push('Goal success cannot be interpreted before verification');
  }
  return { valid: errors.length === 0, errors };
}

export function assessCapabilityOutcome(observation) {
  const validation = validateCapabilityOutcomeObservation(observation);
  if (!validation.valid) {
    return {
      ...validation,
      recommendation: 'hold',
      promotionAllowed: false,
      founderReviewRequired: true,
      confidenceCap: 0,
      reasons: ['Invalid or incomplete outcome evidence cannot change routing policy.'],
    };
  }

  const reasons = [];
  let recommendation = 'hold';
  let confidenceCap = Math.min(90, observation.evidenceCompleteness);

  if (!observation.verified) {
    reasons.push('Outcome is not verified.');
    confidenceCap = Math.min(confidenceCap, 40);
  } else if (observation.goalSucceeded === false) {
    recommendation = 'review';
    reasons.push('The workflow executed, but the founder goal did not succeed.');
    confidenceCap = Math.min(confidenceCap, 60);
  } else if (observation.rollbackUsed) {
    recommendation = 'review';
    reasons.push('Rollback was required; do not promote the capability from this run.');
    confidenceCap = Math.min(confidenceCap, 60);
  } else if (observation.founderOverride) {
    recommendation = 'review';
    reasons.push('Founder override occurred; inspect why the route missed founder judgment.');
    confidenceCap = Math.min(confidenceCap, 70);
  } else if (observation.goalSucceeded === true && observation.evidenceCompleteness >= 80) {
    recommendation = 'candidate-promote';
    reasons.push('Verified goal success with strong evidence may justify a tested capability-version candidate.');
  } else {
    reasons.push('Evidence is insufficient for a promotion candidate.');
  }

  return {
    valid: true,
    errors: [],
    recommendation,
    promotionAllowed: false,
    founderReviewRequired: true,
    confidenceCap,
    reasons,
  };
}
