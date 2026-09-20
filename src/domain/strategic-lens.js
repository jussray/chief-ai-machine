// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const STRATEGIC_LENS_CONTRACT = 'juss-v10/strategic-lens-policy@v1';
export const PROMPTOS_FOUNDER_DECISION_POLICY_CONTRACT = 'promptos/founder-decision-policies@v1';

const FOUNDER_HYPOTHESIS_LENSES = new Set([
  'hormozi',
  'billgates',
  'elonmusk',
  'garyvee',
]);

const PROMPTOS_POLICY_LENSES = new Set(['billgates', 'elonmusk']);

function clean(value) {
  return typeof value === 'string'
    ? value.trim().replace(/^\/+/, '').toLowerCase().slice(0, 120)
    : '';
}

/**
 * Strategic lenses shape questions and hypotheses only. They do not participate in
 * authority resolution, approval, or execution permission. Unknown lenses remain
 * non-authoritative reasoning labels rather than becoming implicit capabilities.
 *
 * Bill/Elon carry a reference to the canonical PromptOS executable policy contract.
 * Chief does not copy or execute that scorer locally: PromptOS owns policy semantics,
 * while the consuming project supplies its own proof requirements and FCR retains
 * consequential execution authority.
 */
export function strategicLensPolicy(value) {
  const id = clean(value);
  if (!id) throw new Error('Strategic lens id is required');
  const promptosBound = PROMPTOS_POLICY_LENSES.has(id);
  return Object.freeze({
    contract: STRATEGIC_LENS_CONTRACT,
    id,
    kind: FOUNDER_HYPOTHESIS_LENSES.has(id) ? 'hypothesis_generator' : 'reasoning_lens',
    mayAffectReasoning: true,
    mayAffectAuthority: false,
    mayAuthorizeExecution: false,
    maySatisfyEvidence: false,
    decisionPolicyOwner: promptosBound ? 'jussray/promptos' : null,
    decisionPolicyContract: promptosBound ? PROMPTOS_FOUNDER_DECISION_POLICY_CONTRACT : null,
    decisionPolicyBinding: promptosBound ? 'reference-only' : null,
    requiresSharedEvidence: promptosBound,
    requiresProjectProofAdapter: promptosBound,
    mayImplementDecisionPolicyLocally: false,
  });
}

export function strategicLensPolicies(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(clean).filter(Boolean))]
    .sort()
    .map((id) => strategicLensPolicy(id));
}