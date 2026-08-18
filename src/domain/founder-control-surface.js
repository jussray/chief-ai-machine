export const FOUNDER_CONTROL_DECISION_CONTRACT = 'juss-v10/founder-control-decision@v1';
export const FOUNDER_CONTROL_SURFACES = Object.freeze(['fcr', 'chatgpt', 'claude', 'perplexity']);
export const FOUNDER_CONTROL_ORCHESTRATORS = Object.freeze(['n8n', 'zapier']);

/**
 * Chief only describes the founder-control handoff. It never converts a
 * proposal, model response, silence, or prior outcome into founder approval.
 */
export function founderControlHandoff(capabilityPlan) {
  if (!capabilityPlan || typeof capabilityPlan !== 'object') {
    throw new Error('Chief capability plan is required for founder control handoff.');
  }
  const planHash = typeof capabilityPlan.planHash === 'string'
    ? capabilityPlan.planHash.trim().toLowerCase()
    : '';
  if (!/^[0-9a-f]{64}$/.test(planHash)) {
    throw new Error('Chief capability plan hash must be a 64-character SHA-256 hash.');
  }

  return {
    contract: FOUNDER_CONTROL_DECISION_CONTRACT,
    surfaces: [...FOUNDER_CONTROL_SURFACES],
    orchestrators: [...FOUNDER_CONTROL_ORCHESTRATORS],
    capabilityPlanHash: planHash,
    founderDecisionRequired: true,
    explicitDecisionOnly: true,
    proposalMutationInvalidatesApproval: true,
    surfaceMaySelfAuthorize: false,
    chiefMaySelfAuthorize: false,
    executionAuthorized: false,
    receiptRequiredAfterExecution: true,
  };
}
