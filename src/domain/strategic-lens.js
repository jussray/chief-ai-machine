// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const STRATEGIC_LENS_CONTRACT = 'juss-v10/strategic-lens-policy@v1';

const FOUNDER_HYPOTHESIS_LENSES = new Set([
  'hormozi',
  'billgates',
  'elonmusk',
  'garyvee',
]);

function clean(value) {
  return typeof value === 'string'
    ? value.trim().replace(/^\/+/, '').toLowerCase().slice(0, 120)
    : '';
}

/**
 * Strategic lenses shape questions and hypotheses only. They do not participate in
 * authority resolution, approval, or execution permission. Unknown lenses remain
 * non-authoritative reasoning labels rather than becoming implicit capabilities.
 */
export function strategicLensPolicy(value) {
  const id = clean(value);
  if (!id) throw new Error('Strategic lens id is required');
  return Object.freeze({
    contract: STRATEGIC_LENS_CONTRACT,
    id,
    kind: FOUNDER_HYPOTHESIS_LENSES.has(id) ? 'hypothesis_generator' : 'reasoning_lens',
    mayAffectReasoning: true,
    mayAffectAuthority: false,
    mayAuthorizeExecution: false,
    maySatisfyEvidence: false,
  });
}

export function strategicLensPolicies(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(clean).filter(Boolean))]
    .sort()
    .map((id) => strategicLensPolicy(id));
}
