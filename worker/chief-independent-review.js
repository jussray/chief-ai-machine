import { createReviewBundle } from '../src/domain/review-orchestrator.js';

const ROUTE = '/api/chief/independent-review';

function meta() {
  return {
    requestId: globalThis.crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    provenanceId: null,
  };
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function errorResponse(code, message, status = 400) {
  return json({ data: null, meta: meta(), error: { code, message } }, status);
}

export async function handleChiefIndependentReview(request) {
  const url = new URL(request.url);
  if (url.pathname !== ROUTE) return errorResponse('not_found', 'Independent review route not found.', 404);
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 'POST is required for independent review proposals.', 405);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return errorResponse('invalid_json', 'Request body must be valid JSON.');
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return errorResponse('invalid_review_request', 'Request body must be a JSON object.');
  }

  try {
    const reviewBundle = createReviewBundle({ reviews: input.reviews });
    return json({
      data: {
        reviewBundle,
        governanceBoundary: {
          proposalOnly: true,
          mergeAuthorized: false,
          executionAuthorized: false,
          repositoryWitnessVerifiedByFcr: false,
          semanticProviderExecutedByThisRoute: false,
          pythonExecutedByThisRoute: false,
          nextGate:
            'Founder Control Room must validate exact repository/PR/head/diff/policy context and a repository-provider witness for each review receipt before the review gate can be satisfied.',
        },
      },
      meta: meta(),
      error: null,
    });
  } catch (error) {
    return errorResponse(
      'invalid_review_request',
      error instanceof Error ? error.message : 'Independent review proposal could not be created.',
    );
  }
}
