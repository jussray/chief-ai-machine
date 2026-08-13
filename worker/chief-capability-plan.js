import {
  createExecutionHandoffReceipt,
  createGoalCapabilityPlan,
} from '../src/domain/capability-registry.js';

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
    const capabilityPlan = createGoalCapabilityPlan({
      goalPlan: input.goalPlan,
      registrySnapshot: input.registrySnapshot,
      expectedHeadSha: input.expectedHeadSha,
      requestedAuthority: input.requestedAuthority || 'reason',
    });
    const handoffReceipt = createExecutionHandoffReceipt(capabilityPlan);

    return json({
      data: {
        capabilityPlan,
        handoffReceipt,
        governanceBoundary: {
          proposalOnly: true,
          executionAuthorized: false,
          registrySnapshotResolvedByFcr: false,
          exactHeadVerifiedByFcr: false,
          founderApprovalRequired: true,
          nextGate:
            'Founder Control Room must resolve the approved registry snapshot, verify exact-head context, and bind explicit founder approval before any execution lane may act.',
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
