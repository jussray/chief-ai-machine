import { sha256Hex, validateCapabilityPlan } from './capability-plan.js';

export const FOUNDER_AUTHORITY_HANDOFF_CONTRACT = 'chief-ai/founder-authority-handoff@v1';

export const FOUNDER_AUTHORITY_HANDOFF_AUTHORITY = Object.freeze({
  scope: 'proposal-only',
  sourceSystem: 'chief-ai-machine',
  targetSystem: 'founder-control-room',
  permitsApproval: false,
  permitsExecution: false,
  permitsRepositoryWrite: false,
  permitsDeployment: false,
  permitsPublishing: false,
  permitsProviderMutation: false,
  permitsFounderImpersonation: false,
  cookieAuthority: 'forbidden',
});

const FULL_SHA = /^[0-9a-f]{40}$/i;
const HASH = /^[0-9a-f]{64}$/i;

function cleanText(value, maxLength = 2000) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanStringList(values, maxItems = 30, maxLength = 500) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))]
    .sort()
    .slice(0, maxItems);
}

function authorityCopy() {
  return { ...FOUNDER_AUTHORITY_HANDOFF_AUTHORITY };
}

function authorityIsProposalOnly(authority) {
  if (!authority || typeof authority !== 'object' || Array.isArray(authority)) return false;
  const expectedKeys = Object.keys(FOUNDER_AUTHORITY_HANDOFF_AUTHORITY).sort();
  const actualKeys = Object.keys(authority).sort();
  if (expectedKeys.length !== actualKeys.length
    || expectedKeys.some((key, index) => key !== actualKeys[index])) return false;

  return expectedKeys.every((key) => authority[key] === FOUNDER_AUTHORITY_HANDOFF_AUTHORITY[key]);
}

function handoffSeed(handoff) {
  return JSON.stringify([
    handoff.contract,
    handoff.sourceSystem,
    handoff.targetSystem,
    handoff.projectSlug,
    handoff.goal,
    handoff.capabilityPlanHash,
    handoff.expectedHeadSha,
    handoff.requestedAuthority,
    handoff.proofRequirements,
    handoff.outcomeSignals,
    handoff.rollback,
    handoff.authority,
  ]);
}

export function founderAuthorityHandoffFingerprint(handoff) {
  return sha256Hex(handoffSeed(handoff));
}

export function createFounderAuthorityHandoff(capabilityPlan) {
  const planValidation = validateCapabilityPlan(capabilityPlan);
  if (!planValidation.valid) {
    throw new Error(`Capability plan is invalid: ${planValidation.errors.join('; ')}`);
  }

  const handoff = {
    contract: FOUNDER_AUTHORITY_HANDOFF_CONTRACT,
    sourceSystem: 'chief-ai-machine',
    targetSystem: 'founder-control-room',
    projectSlug: cleanText(capabilityPlan.projectSlug, 160),
    goal: cleanText(capabilityPlan.goal, 2000),
    capabilityPlanHash: capabilityPlan.planHash.toLowerCase(),
    expectedHeadSha: capabilityPlan.expectedHeadSha.toLowerCase(),
    requestedAuthority: capabilityPlan.requestedAuthority,
    proofRequirements: cleanStringList(capabilityPlan.proofRequirements),
    outcomeSignals: cleanStringList(capabilityPlan.outcomeSignals),
    rollback: cleanText(capabilityPlan.rollback, 2000),
    authority: authorityCopy(),
  };

  return {
    ...handoff,
    fingerprint: founderAuthorityHandoffFingerprint(handoff),
  };
}

export function validateFounderAuthorityHandoff(handoff, capabilityPlan) {
  const errors = [];

  if (!handoff || typeof handoff !== 'object' || Array.isArray(handoff)) {
    return { valid: false, errors: ['Founder authority handoff must be an object'] };
  }

  const planValidation = validateCapabilityPlan(capabilityPlan);
  if (!planValidation.valid) {
    return { valid: false, errors: [`Capability plan is invalid: ${planValidation.errors.join('; ')}`] };
  }

  if (handoff.contract !== FOUNDER_AUTHORITY_HANDOFF_CONTRACT) errors.push('Unsupported founder authority handoff contract');
  if (handoff.sourceSystem !== 'chief-ai-machine') errors.push('Founder authority handoff source must be Chief AI Machine');
  if (handoff.targetSystem !== 'founder-control-room') errors.push('Founder authority handoff target must be Founder Control Room');
  if (!cleanText(handoff.projectSlug, 160)) errors.push('Founder authority handoff projectSlug is required');
  if (!cleanText(handoff.goal, 2000)) errors.push('Founder authority handoff goal is required');
  if (!HASH.test(cleanText(handoff.capabilityPlanHash, 64))) errors.push('Founder authority handoff capabilityPlanHash must be sha256');
  if (!FULL_SHA.test(cleanText(handoff.expectedHeadSha, 40))) errors.push('Founder authority handoff expectedHeadSha must be a full Git SHA');
  if (!authorityIsProposalOnly(handoff.authority)) errors.push('Founder authority handoff must remain proposal-only and cookie-free for authority');

  if (handoff.projectSlug !== capabilityPlan.projectSlug) errors.push('Founder authority handoff project does not match capability plan');
  if (handoff.goal !== capabilityPlan.goal) errors.push('Founder authority handoff goal does not match capability plan');
  if (handoff.capabilityPlanHash !== capabilityPlan.planHash.toLowerCase()) errors.push('Founder authority handoff plan hash does not match capability plan');
  if (handoff.expectedHeadSha !== capabilityPlan.expectedHeadSha.toLowerCase()) errors.push('Founder authority handoff head SHA does not match capability plan');
  if (handoff.requestedAuthority !== capabilityPlan.requestedAuthority) errors.push('Founder authority handoff requested authority does not match capability plan');

  const expectedProof = cleanStringList(capabilityPlan.proofRequirements);
  const expectedSignals = cleanStringList(capabilityPlan.outcomeSignals);
  if (JSON.stringify(handoff.proofRequirements) !== JSON.stringify(expectedProof)) errors.push('Founder authority handoff proof requirements do not match capability plan');
  if (JSON.stringify(handoff.outcomeSignals) !== JSON.stringify(expectedSignals)) errors.push('Founder authority handoff outcome signals do not match capability plan');
  if (handoff.rollback !== cleanText(capabilityPlan.rollback, 2000)) errors.push('Founder authority handoff rollback does not match capability plan');

  if ('actor' in handoff || 'founderId' in handoff || 'decisionReceiptId' in handoff || 'policyDecisionId' in handoff) {
    errors.push('Chief authority handoff cannot claim founder identity or decision authority');
  }

  if (!HASH.test(cleanText(handoff.fingerprint, 64))) errors.push('Founder authority handoff fingerprint must be sha256');
  else if (founderAuthorityHandoffFingerprint(handoff) !== handoff.fingerprint.toLowerCase()) {
    errors.push('Founder authority handoff fingerprint does not match content');
  }

  return { valid: errors.length === 0, errors };
}
