import {
  createExecutionHandoffReceipt,
  resolveCapabilities,
} from '../src/domain/capability-registry.js';
import { createCapabilityPlan } from '../src/domain/capability-plan.js';
import { validateGoalPlan } from '../src/domain/goal-plan.js';
import { applyCapabilityOutcomeFeedback } from '../src/domain/outcome-feedback.js';
import { founderControlHandoff } from '../src/domain/founder-control-surface.js';

const ROUTE = '/api/chief/capability-plan';

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
    'Founder Control Room trust resolution is still required.',
    `Next gate: ${goalPlan.nextGate}`,
  ].join(' ');

  return createCapabilityPlan({
    goal: goalPlan.goal,
    projectSlug: goalPlan.project,
    expectedHeadSha: input.expectedHeadSha,
    registryHash: registrySnapshot.registryHash,
    requestedAuthority: outcomeFeedback.effectiveAuthority,
    strategicLenses: goalPlan.strategicLenses,
    routingReason,
    capabilities,
    proofRequirements: goalPlan.proofRequirements,
    outcomeSignals: [goalPlan.definitionOfDone],
    rollback: goalPlan.rollback,
  });
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
    const handoffReceipt = createExecutionHandoffReceipt(capabilityPlan);
    const founderControl = founderControlHandoff(capabilityPlan);

    return json({
      data: {
        capabilityPlan,
        handoffReceipt,
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
          nextGate:
            'Founder Control Room must resolve the approved registry snapshot, verify exact-head context, authenticate/bind outcome evidence, and bind an explicit founder decision relayed from FCR, ChatGPT, Claude, or Perplexity before n8n or Zapier may execute the exact approved proposal.',
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
