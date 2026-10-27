/* global AbortSignal */

const MAX_REQUEST_BYTES = 16 * 1024;
const MAX_RESPONSE_BYTES = 64 * 1024;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function authorized(request, expected) {
  const supplied = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!supplied || supplied.length > 1024) return false;
  // Compare fixed-size digests; never return or log either credential.
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

/** Operator-only, stateless reasoning. No asset lookup, storage, tools, or action authority. */
export async function handleChiefProviderRequest(request, env, fetchImpl = fetch) {
  if (!env.CHIEF_AI_OPERATOR_KEY) return json({ error: 'operator_not_configured' }, 503);
  if (!await authorized(request, env.CHIEF_AI_OPERATOR_KEY)) return json({ error: 'unauthorized' }, 401);

  const key = env.OPENAI_API_KEY?.trim();
  const model = env.CHIEF_OPENAI_MODEL?.trim();
  if (request.method === 'GET') {
    return json({ service: 'chief-ai', provider: 'openai', state: key && model ? 'INTEGRATED' : 'ABSENT', model: model || null, authority: 'none' });
  }
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  if (!key || !model) return json({ error: 'provider_not_configured' }, 503);
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
    || typeof input.prompt !== 'string' || !input.prompt.trim() || input.prompt.length > 8000
    || Object.keys(input).some((name) => !['prompt', 'sensitivity'].includes(name))) {
    return json({ error: 'invalid_request' }, 400);
  }

  try {
    const response = await fetchImpl('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        instructions: 'Provide bounded reasoning only. Your output is an unreviewed draft, not founder approval or authority to execute, merge, deploy, publish, spend, or access other data. Do not claim tool execution.',
        input: input.prompt,
        store: false,
        max_output_tokens: 1000,
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      await response.body?.cancel();
      return json({ error: 'provider_failed', provider_status: response.status }, 502);
    }
    const body = JSON.parse(await boundedText(response.body, MAX_RESPONSE_BYTES));
    if (body.status !== 'completed' || typeof body.id !== 'string' || !/^resp_[A-Za-z0-9_-]{1,180}$/.test(body.id)) {
      return json({ error: 'provider_response_invalid' }, 502);
    }
    const text = (Array.isArray(body.output) ? body.output : [])
      .filter((item) => item.type === 'message' && item.role === 'assistant')
      .flatMap((item) => Array.isArray(item.content) ? item.content : [])
      .filter((item) => item.type === 'output_text' && typeof item.text === 'string')
      .map((item) => item.text).join('\n').trim();
    if (!text) return json({ error: 'provider_response_invalid' }, 502);
    return json({ service: 'chief-ai', provider: 'openai', model, text, response_id: body.id,
      evidence_ref: `provider:openai:${body.id}`, state: 'draft', authority: 'none' });
  } catch {
    // Provider exceptions and bodies can echo credentials or submitted context.
    return json({ error: 'provider_failed' }, 502);
  }
}
