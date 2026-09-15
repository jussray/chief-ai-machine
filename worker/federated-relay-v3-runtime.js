import { handleFederatedRelayV3 } from './federated-relay-v3.js';

const MAX_RELAY_ENVELOPE_BYTES = 65536;

function json(body, status) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function failure(error, status) {
  return json({
    error,
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
  }, status);
}

async function readBodyBounded(request, maxBytes = MAX_RELAY_ENVELOPE_BYTES) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('relay_envelope_json_invalid');

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!(value instanceof Uint8Array)) throw new Error('relay_envelope_json_invalid');
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new Error('relay_envelope_too_large');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function handleFederatedRelayV3BoundToRuntime(request, env, runtimeSha, runtimeBranch) {
  if (request.method !== 'POST') return handleFederatedRelayV3(request, env, runtimeSha);

  const normalizedBranch = typeof runtimeBranch === 'string' ? runtimeBranch.trim() : '';
  if (!normalizedBranch || normalizedBranch === 'unknown' || normalizedBranch.length > 120) {
    return failure('relay_runtime_branch_unavailable', 503);
  }

  let bodyBytes;
  let input;
  try {
    bodyBytes = await readBodyBounded(request);
    input = JSON.parse(new TextDecoder().decode(bodyBytes));
  } catch (error) {
    const code = error instanceof Error ? error.message : 'relay_envelope_json_invalid';
    return failure(code === 'relay_envelope_too_large' ? code : 'relay_envelope_json_invalid', code === 'relay_envelope_too_large' ? 413 : 400);
  }

  const claimedBranch = typeof input?.target?.branch === 'string' ? input.target.branch.trim() : '';
  if (claimedBranch !== normalizedBranch) {
    return failure('relay_target_identity_stale', 409);
  }

  const forwarded = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body: bodyBytes,
  });
  return handleFederatedRelayV3(forwarded, env, runtimeSha);
}
