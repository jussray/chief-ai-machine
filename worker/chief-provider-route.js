import {
  cancelChiefAnthropicBatch,
  createChiefAnthropicBatch,
  getChiefAnthropicBatch,
  getChiefAnthropicBatchResults,
  invokeChiefProvider,
} from './provider-runtime.js';

const ROUTE = '/api/chief/provider';

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function errorResponse(code, message, status, externalProviderCall = false) {
  return json({
    data: null,
    governance: {
      authority: 'none',
      executionAuthorized: false,
      founderApprovalCarriedForward: false,
      externalProviderCall,
    },
    error: { code, message },
  }, status);
}

function runtimeEnabled(env) {
  return String(env?.CHIEF_PROVIDER_RUNTIME_ENABLED || '').trim().toLowerCase() === 'true';
}

function classifyError(error) {
  const message = error instanceof Error ? error.message : 'provider request failed';
  if (/not configured/.test(message)) return ['provider_not_configured', message, 503, false];
  if (/provider request failed|provider failed with HTTP|invalid JSON|invalid response identity|no usable text|response too large|non-completed response|batch .*request failed|batch .*failed with HTTP|batch .*invalid JSON|batch .*invalid identity|batch results exceeded/.test(message)) {
    return ['provider_execution_failed', message, 502, true];
  }
  return ['invalid_provider_request', message, 400, false];
}

export async function handleChiefProviderRoute(request, env, fetchImpl = fetch) {
  const url = new URL(request.url);
  if (url.pathname !== ROUTE) {
    return errorResponse('not_found', 'Chief provider route not found.', 404);
  }
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 'POST is required for Chief provider execution.', 405);
  }
  if (!runtimeEnabled(env)) {
    return errorResponse('provider_runtime_disabled', 'Chief provider runtime is disabled.', 503);
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return errorResponse('invalid_json', 'Request body must be valid JSON.', 400);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return errorResponse('invalid_provider_request', 'Request body must be a JSON object.', 400);
  }

  try {
    let result;
    if (String(input.mode || 'standard').trim().toLowerCase() === 'batch') {
      const operation = String(input.operation || 'create').trim().toLowerCase();
      if (operation === 'create') {
        result = await createChiefAnthropicBatch(env, input, fetchImpl);
      } else if (operation === 'status') {
        result = await getChiefAnthropicBatch(env, input.batchId, fetchImpl);
      } else if (operation === 'results') {
        result = await getChiefAnthropicBatchResults(env, input.batchId, fetchImpl);
      } else if (operation === 'cancel') {
        result = await cancelChiefAnthropicBatch(env, input.batchId, fetchImpl);
      } else {
        throw new Error('unsupported Anthropic batch operation');
      }
    } else {
      result = await invokeChiefProvider(env, input, fetchImpl);
    }
    return json({
      data: result,
      governance: {
        authority: 'none',
        executionAuthorized: false,
        founderApprovalCarriedForward: false,
        externalProviderCall: true,
      },
      error: null,
    });
  } catch (error) {
    const [code, message, status, externalProviderCall] = classifyError(error);
    return errorResponse(code, message, status, externalProviderCall === true);
  }
}
