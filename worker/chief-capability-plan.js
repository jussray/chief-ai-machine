import {
  createExecutionHandoffReceipt,
  resolveCapabilities,
} from '../src/domain/capability-registry.js';
import { createCapabilityPlan, sha256Hex } from '../src/domain/capability-plan.js';
import { createConnectionHandoff } from '../src/domain/connection-requests.js';
import { validateGoalPlan } from '../src/domain/goal-plan.js';
import { applyCapabilityOutcomeFeedback } from '../src/domain/outcome-feedback.js';
import { founderControlHandoff } from '../src/domain/founder-control-surface.js';

const ROUTE = '/api/chief/capability-plan';

export const CHIEF_TRUSTED_REASONING_POLICY_CONTRACT = 'juss/chief-trusted-reasoning-policy@v1';
export const CHIEF_TRUSTED_STRATEGIC_LENSES = Object.freeze([
  'ultrathink',
  'futureyou',
  'truthmode',
  'redteam',
  'lindymode',
  'ooda',
  'product-design',
  'data-analytics',
  'deep-research',
]);
export const CHIEF_ATTACK_FAMILIES = Object.freeze([
  'evidence-truth',
  'authority-boundary',
  'currentness-temporal-race',
  'recovery-rollback',
  'human-outcome',
  'privacy-security',
  'cross-project-scope',
  'provider-integration',
  'operability-performance',
  'contradiction-assumption',
]);

function meta() {
  return {
    requestId: globalThis.crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    provenanceId: null,
  };
}

function json(payload, status = 200, extraHeaders = {}) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}

function errorResponse(code, message, status = 400) {
  return json({
    data: null,
    meta: meta(),
    error: { code, message },
  }, status);
}

function createSubmittedRegistryProposal(input, outcomeFeedback) {
  const goalPlan = input.goalPlan;
  const registrySnapshot = input.registrySnapshot;
  const goalValidation = validateGoalPlan(goalPlan);
  if (!goalValidation.valid) {
    throw new Error(`Founder goal is not ready: ${goalValidation.errors.join('; ')}`);
  }

  const capabilities = resolveCapabilities(registrySnapshot, goalPlan.capabilities);
  const feedbackReason = outcomeFeedback.observed
    ? `Submitted prior outcome recommends ${outcomeFeedback.recommendation}; next-plan authority is ${outcomeFeedback.effectiveAuthority}. Source trust remains ${outcomeFeedback.sourceTrust}.`
    : 'No prior outcome observation was supplied; existing proposal authority rules apply.';
  const routingReason = [
    `Founder goal composed against submitted registry snapshot ${registrySnapshot.registryId}@${registrySnapshot.version}.`,
    feedbackReason,
    'Chief strategic reasoning policy is server-owned; caller-supplied workflow or lens names are non-authorizing context and cannot activate a workflow.',
    'Founder Control Room trust resolution is still required.',
    `Next gate: ${goalPlan.nextGate}`,
  ].join(' ');

  return createCapabilityPlan({
    goal: goalPlan.goal,
    projectSlug: goalPlan.project,
    expectedHeadSha: input.expectedHeadSha,
    registryHash: registrySnapshot.registryHash,
    requestedAuthority: outcomeFeedback.effectiveAuthority,
    strategicLenses: CHIEF_TRUSTED_STRATEGIC_LENSES,
    routingReason,
    capabilities,
    proofRequirements: goalPlan.proofRequirements,
    outcomeSignals: [goalPlan.definitionOfDone],
    rollback: goalPlan.rollback,
  });
}

function createTrustedReasoningPolicy(capabilityPlan) {
  const receipt = {
    contract: CHIEF_TRUSTED_REASONING_POLICY_CONTRACT,
    subjectPlanHash: capabilityPlan.planHash,
    policy: 'ultrathink',
    activation: 'server-owned',
    callerMaySelectPolicy: false,
    untrustedWorkflowTokensInert: true,
    strategicLenses: [...CHIEF_TRUSTED_STRATEGIC_LENSES],
    attackBudget: 1000,
    attackBudgetSemantics: 'reasoning pressure-test budget; not proof that 1000 tool actions or external mutations executed',
    executedAttackCount: null,
    attackFamilies: [...CHIEF_ATTACK_FAMILIES],
    truthRules: {
      proofBeforeClaim: true,
      activityIsNotAccomplishment: true,
      executionTruthIsNotOutcomeTruth: true,
      historicalTruthImmutable: true,
      currentTruthMustBeReobserved: true,
    },
    authority: {
      authorityCeiling: 'reason',
      founderApprovalGranted: false,
      executionAuthorized: false,
      providerMutationAuthorized: false,
      mergeAuthorized: false,
      deployAuthorized: false,
      publicationAuthorized: false,
      outcomeVerified: false,
      nextAuthority: 'founder-control-room',
    },
  };

  return {
    ...receipt,
    policyHash: sha256Hex(JSON.stringify(receipt)),
  };
}

export async function handleChiefCapabilityPlan(request) {
  const url = new URL(request.url);
  if (url.pathname !== ROUTE) {
    return errorResponse('not_found', 'Chief capability-plan route not found.', 404);
  }

  if (request.method !== 'POST') {
    return errorResponse(
      'method_not_allowed',
      'POST is required for capability-plan proposals.',
      405,
    );
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return errorResponse('invalid_json', 'Request body must be valid JSON.');
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return errorResponse('invalid_capability_plan_request', 'Request body must be a JSON object.');
  }

  try {
    const outcomeFeedback = applyCapabilityOutcomeFeedback(
      input.requestedAuthority || 'reason',
      input.latestOutcomeObservation,
    );
    const capabilityPlan = createSubmittedRegistryProposal(input, outcomeFeedback);
    const reasoningPolicy = createTrustedReasoningPolicy(capabilityPlan);
    const handoffReceipt = createExecutionHandoffReceipt(capabilityPlan);
    const connectionHandoff = createConnectionHandoff(input.connectionRequests);
    // Chief describes the remote founder-control handoff; it never resolves approval itself.
    const founderControl = founderControlHandoff(capabilityPlan);

    return json({
      data: {
        capabilityPlan,
        reasoningPolicy,
        handoffReceipt,
        connectionHandoff,
        outcomeFeedback,
        founderControl,
        governanceBoundary: {
          proposalOnly: true,
          executionAuthorized: false,
          registrySnapshotResolvedByFcr: false,
          exactHeadVerifiedByFcr: false,
          founderApprovalRequired: true,
          outcomeCanIncreaseAuthority: false,
          submittedOutcomeAuthenticated: false,
          remoteFounderSurfacesMaySelfAuthorize: false,
          callerWorkflowTokensAuthoritative: false,
          connectionResolutionAuthority: 'founder-control-room',
          rawCredentialsAccepted: false,
          rawCredentialsReturned: false,
          connectionResolver: '/mcp/vault/resolve',
          nextGate:
            'Founder Control Room must resolve the approved registry snapshot, verify exact-head context, authenticate/bind outcome evidence, resolve credential-free connection requirements, and bind an explicit founder decision relayed from FCR, ChatGPT, Claude, or Perplexity before n8n or Zapier may execute the exact approved proposal.',
        },
      },
      meta: meta(),
      error: null,
    });
  } catch (error) {
    return errorResponse(
      'invalid_capability_plan_request',
      error instanceof Error ? error.message : 'Capability-plan proposal could not be created.',
    );
  }
}
