import { createControlRoomRecommendation } from '../src/domain/control-room-recommendation.js';

const ROUTE = '/api/chief/control-room-recommendation';
const FORBIDDEN_KEYS = new Set([
  'apikey',
  'api_key',
  'credential',
  'credentials',
  'password',
  'privatekey',
  'private_key',
  'secret',
  'secretreference',
  'secret_ref',
  'token',
]);

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
  return json({
    data: null,
    meta: meta(),
    error: { code, message },
  }, status);
}

function findForbiddenFields(value, path = '') {
  if (!value || typeof value !== 'object') return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => findForbiddenFields(entry, `${path}[${index}]`));
  }

  const found = [];
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[-\s]/g, '_');
    const compact = normalized.replace(/_/g, '');
    const childPath = path ? `${path}.${key}` : key;
    if (FORBIDDEN_KEYS.has(normalized) || FORBIDDEN_KEYS.has(compact)) found.push(childPath);
    found.push(...findForbiddenFields(child, childPath));
  }
  return found;
}

export async function handleChiefControlRoomRecommendation(request) {
  const url = new URL(request.url);
  if (url.pathname !== ROUTE) {
    return errorResponse('not_found', 'Chief Control Room recommendation route not found.', 404);
  }

  if (request.method !== 'POST') {
    return errorResponse(
      'method_not_allowed',
      'POST is required for Control Room recommendations.',
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
    return errorResponse(
      'invalid_control_room_recommendation_request',
      'Request body must be a JSON object.',
    );
  }

  const forbiddenFields = findForbiddenFields(input);
  if (forbiddenFields.length > 0) {
    return errorResponse(
      'credentials_not_accepted',
      `Onboarding recommendations do not accept credential fields: ${forbiddenFields.join(', ')}`,
    );
  }

  try {
    const recommendation = createControlRoomRecommendation(input);
    return json({
      data: {
        recommendation,
        governanceBoundary: {
          proposalOnly: true,
          founderApprovalRequired: true,
          executionAuthorized: false,
          createControlRoomAuthorized: false,
          projectStateMutationAuthorized: false,
          providerMutationAuthorized: false,
          mergeAuthorized: false,
          deploymentAuthorized: false,
          credentialAuthority: 'none',
          stateAuthority: 'founder-control-room',
          evidenceAuthority: 'founder-control-room',
          recommendationMutationInvalidatesAcceptance: true,
          nextGate: 'Founder reviews the recommendation, then Founder Control Room independently resolves evidence and authority before creating or mutating room state.',
        },
      },
      meta: meta(),
      error: null,
    });
  } catch (error) {
    return errorResponse(
      'invalid_control_room_recommendation_request',
      error instanceof Error ? error.message : 'Control Room recommendation could not be created.',
    );
  }
}
