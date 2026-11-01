/* global crypto */

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

/**
 * Operator-authenticated HTTP membrane for Chief's shared provider runtime.
 * The wrapper grants no provider tools, storage, merge, deploy, publish, spend,
 * or approval authority. It only exposes bounded draft inference.
 */
export async function handleChiefProviderRequest(request, env, fetchImpl = fetch) {
  if (!env?.CHIEF_AI_OPERATOR_KEY) return json({ error: 'operator_not_configured' }, 503);
  if (!await authorized(request, env.CHIEF_AI_OPERATOR_KEY)) return json({ error: 'unauthorized' }, 401);

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
    });
  } catch {
    return json({ error: 'provider_failed' }, 502);
  }
}
