import { invokeChiefProvider } from './provider-runtime.js';

const MAX_REQUEST_BYTES = 16 * 1024;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function authorized(request, expected) {
  const supplied = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!supplied || supplied.length > 1024 || !expected) return false;
  const digest = (value) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  const [left, right] = await Promise.all([digest(supplied), digest(expected)]);
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

async function boundedText(body, maximum) {
  if (!body) return '';
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) return text + decoder.decode();
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new Error('body_too_large');
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

function runtimeConfigured(env) {
  return Boolean(env?.OPENAI_API_KEY?.trim() && env?.CHIEF_OPENAI_MODEL?.trim());
}

const PROTECT2_GATE_URL = 'https://protect2.jussco.company/gateway/check';
const PROTECT2_PILOT_TOOL = 'chief.draft.generate';
const PROTECT2_TIMEOUT_MS = 4_000;

/**
 * Opt-in, non-consequential pilot. Never forwards prompts or private content.
 * A gate decision is evidence for this one draft action, not execution authority.
 */
async function checkProtect2PublicDraft(env, sensitivity, fetchImpl) {
  const mode = typeof env?.CHIEF_PROTECT2_PILOT_MODE === 'string'
    ? env.CHIEF_PROTECT2_PILOT_MODE.trim()
    : '';
  if (!mode) return { allowed: true, enforced: false };
  if (mode !== 'enforce-public-draft') {
    return { allowed: false, status: 503, error: 'protect2_pilot_invalid_mode' };
  }
  if (sensitivity !== 'public') {
    return { allowed: false, status: 403, error: 'protect2_pilot_public_only' };
  }

  const key = typeof env?.CHIEF_PROTECT2_API_KEY === 'string'
    ? env.CHIEF_PROTECT2_API_KEY.trim()
    : '';
  if (!/^jp2_[A-Za-z0-9_-]{8,252}$/.test(key)) {
    return { allowed: false, status: 503, error: 'protect2_pilot_not_configured' };
  }

  let response;
  try {
    response = await fetchImpl(PROTECT2_GATE_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
      },
      // No user prompt, customer data, or model/provider credentials cross this boundary.
      body: JSON.stringify({ tool: PROTECT2_PILOT_TOOL }),
      redirect: 'error',
      cache: 'no-store',
      signal: globalThis.AbortSignal.timeout(PROTECT2_TIMEOUT_MS),
    });
  } catch {
    return { allowed: false, status: 503, error: 'protect2_gateway_unavailable' };
  }

  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* deny regardless */ }
    return {
      allowed: false,
      status: [401, 403, 429].includes(response.status) ? 403 : 503,
      error: [401, 403, 429].includes(response.status)
        ? 'protect2_gateway_denied'
        : 'protect2_gateway_unavailable',
    };
  }

  try {
    // Bound what is accepted from an external response before parsing.
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > 2048) return { allowed: false, status: 503, error: 'protect2_gateway_invalid_response' };
    const raw = await response.text();
    if (raw.length > 2048) return { allowed: false, status: 503, error: 'protect2_gateway_invalid_response' };
    const verdict = JSON.parse(raw);
    if (verdict?.decision === 'block') {
      return { allowed: false, status: 403, error: 'protect2_gateway_denied' };
    }
    const checkedAt = Date.parse(verdict?.checkedAt);
    const ageMs = Date.now() - checkedAt;
    if (verdict?.decision !== 'allow' || !Array.isArray(verdict?.reasons)
        || verdict.reasons.length !== 0 || !Number.isFinite(checkedAt)
        || ageMs < -15_000 || ageMs > 60_000) {
      return { allowed: false, status: 503, error: 'protect2_gateway_invalid_response' };
    }
    return { allowed: true, enforced: true, checkedAt: verdict.checkedAt };
  } catch {
    return { allowed: false, status: 503, error: 'protect2_gateway_invalid_response' };
  }
}

/**
 * Operator-authenticated HTTP membrane for Chief's shared provider runtime.
 * The wrapper grants no provider tools, storage, merge, deploy, publish, spend,
 * or approval authority. It only exposes bounded draft inference.
 */
export async function handleChiefProviderRequest(request, env, fetchImpl = fetch) {
  // Check operator key is configured
  if (!env?.CHIEF_AI_OPERATOR_KEY) return json({ error: 'operator_not_configured' }, 503);

  // Check authorization for all requests (GET and POST)
  const isAuthorized = await authorized(request, env.CHIEF_AI_OPERATOR_KEY);
  if (!isAuthorized) return json({ error: 'unauthorized' }, 401);

  if (request.method === 'GET') {
    return json({
      service: 'chief-ai',
      provider: 'openai',
      state: runtimeConfigured(env) ? 'INTEGRATED' : 'ABSENT',
      model: runtimeConfigured(env) ? env.CHIEF_OPENAI_MODEL.trim() : null,
      authority: 'none',
    });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!runtimeConfigured(env)) return json({ error: 'provider_not_configured' }, 503);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return json({ error: 'json_required' }, 415);
  }

  let input;
  try {
    input = JSON.parse(await boundedText(request.body, MAX_REQUEST_BYTES));
  } catch (error) {
    return json({ error: 'invalid_request' }, error?.message === 'body_too_large' ? 413 : 400);
  }

  if (!input || typeof input !== 'object' || Array.isArray(input)
      || !['public', 'internal'].includes(input.sensitivity)
      || typeof input.prompt !== 'string'
      || !input.prompt.trim()
      || input.prompt.length > 8000
      || Object.keys(input).some((name) => !['prompt', 'sensitivity'].includes(name))) {
    return json({ error: 'invalid_request' }, 400);
  }

  const protection = await checkProtect2PublicDraft(env, input.sensitivity, fetchImpl);
  if (!protection.allowed) return json({ error: protection.error }, protection.status);

  try {
    const result = await invokeChiefProvider(env, {
      provider: 'openai',
      prompt: input.prompt,
      sensitivity: input.sensitivity,
    }, fetchImpl);

    return json({
      service: 'chief-ai',
      provider: 'openai',
      model: result.model,
      text: result.text,
      response_id: result.responseId,
      evidence_ref: result.evidenceRef,
      state: 'draft',
      authority: 'none',
      ...(protection.enforced ? {
        protection: {
          service: 'juss-protect-me-2',
          action: PROTECT2_PILOT_TOOL,
          decision: 'allow',
          checked_at: protection.checkedAt,
          authority: 'none',
        },
      } : {}),
    });
  } catch {
    return json({ error: 'provider_failed' }, 502);
  }
}
