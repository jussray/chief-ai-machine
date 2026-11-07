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

export async function verifyRuntimeBearer(request, token) {
  const expected = typeof token === 'string' ? token : '';
  const presented = /^Bearer ([A-Za-z0-9._~-]{32,256})$/.exec(
    request.headers.get('authorization') || '',
  )?.[1];
  if (expected.length < 32 || expected.length > 256 || !presented || !globalThis.crypto?.subtle) {
    return false;
  }

  // Compare digests without exposing token bytes or a variable-time early exit.
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([
    globalThis.crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    globalThis.crypto.subtle.digest('SHA-256', encoder.encode(presented)),
  ]);
  const expectedHash = new Uint8Array(left);
  const suppliedHash = new Uint8Array(right);
  let mismatch = 0;
  for (let i = 0; i < expectedHash.length; i += 1) {
    mismatch |= expectedHash[i] ^ suppliedHash[i];
  }
  return mismatch === 0;
}

function classifyError(error) {
  // Provider exceptions are untrusted and may contain URLs, headers or tokens.
  const message = error instanceof Error ? error.message : '';
  if (/not configured/.test(message)) {
    return ['provider_not_configured', 'Requested provider is not configured.', 503, false];
  }
  if (/provider request failed|provider failed with HTTP|invalid JSON|invalid response identity|no usable text|response too large|non-completed response|batch .*request failed|batch .*failed with HTTP|batch .*invalid JSON|batch .*invalid identity|batch results exceeded/.test(message)) {
    return ['provider_execution_failed', 'Provider execution failed.', 502, true];
  }
  return ['invalid_provider_request', 'Provider request was rejected.', 400, false];
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

  if (!(await verifyRuntimeBearer(request, env?.CHIEF_PROVIDER_RUNTIME_TOKEN))) {
    return errorResponse('unauthorized', 'Authorized provider runtime token required.', 401);
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
