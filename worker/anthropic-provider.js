/* global AbortSignal */

export const ANTHROPIC_PROVIDER = 'anthropic';
export const ANTHROPIC_MESSAGES_ENDPOINT = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_API_VERSION = '2023-06-01';

const MAX_ERROR_BODY_CHARS = 4096;
const MAX_ERROR_MESSAGE_CHARS = 1024;
const MAX_OUTPUT_TEXT_CHARS = 64 * 1024;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 120_000;
const MAX_MESSAGES = 32;
const MAX_INPUT_CHARS = 200_000;

function text(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function redactSecret(value, secret) {
  const source = typeof value === 'string' ? value : '';
  if (!secret) return source;
  return source.split(secret).join('[REDACTED]');
}

function normalizeRequest(input = {}) {
  const errors = [];
  const model = text(input.model, 160);
  const maxTokens = input.max_tokens ?? 1024;
  const timeoutMs = input.timeout_ms ?? DEFAULT_TIMEOUT_MS;
  const system = input.system === undefined ? null : text(input.system, 50_000);
  const messages = [];
  let totalCharacters = system?.length || 0;

  if (!model) errors.push('model is required');
  if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > 8192) {
    errors.push('max_tokens must be an integer between 1 and 8192');
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > MAX_TIMEOUT_MS) {
    errors.push(`timeout_ms must be an integer between 1000 and ${MAX_TIMEOUT_MS}`);
  }
  if (!Array.isArray(input.messages) || input.messages.length < 1 || input.messages.length > MAX_MESSAGES) {
    errors.push(`messages must contain between 1 and ${MAX_MESSAGES} items`);
  } else {
    for (const item of input.messages) {
      const role = item?.role;
      const content = text(item?.content, MAX_INPUT_CHARS);
      if (role !== 'user' && role !== 'assistant') errors.push('message role must be user or assistant');
      if (!content) errors.push('message content must be a non-empty string');
      totalCharacters += content.length;
      messages.push({ role, content });
    }
  }
  if (totalCharacters > MAX_INPUT_CHARS) errors.push(`combined input exceeds ${MAX_INPUT_CHARS} characters`);
  if (errors.length > 0) {
    throw new AnthropicProviderError('provider_request_invalid', errors.join('; '), 400, null);
  }

  return {
    model,
    max_tokens: maxTokens,
    timeout_ms: timeoutMs,
    ...(system ? { system } : {}),
    messages,
  };
}

function responseRequestId(response, payload) {
  return response.headers?.get?.('request-id')
    || response.headers?.get?.('x-request-id')
    || text(payload?.request_id, 240)
    || null;
}

function extractTextBlocks(content) {
  if (!Array.isArray(content)) return { outputText: '', contentTypes: [] };
  const contentTypes = [];
  let outputText = '';
  for (const block of content.slice(0, 64)) {
    const type = text(block?.type, 80) || 'unknown';
    contentTypes.push(type);
    if (type === 'text' && typeof block?.text === 'string' && outputText.length < MAX_OUTPUT_TEXT_CHARS) {
      const remaining = MAX_OUTPUT_TEXT_CHARS - outputText.length;
      outputText += block.text.slice(0, remaining);
    }
  }
  return { outputText, contentTypes: [...new Set(contentTypes)] };
}

export class AnthropicProviderError extends Error {
  constructor(code, message, status = 500, requestId = null) {
    super(message);
    this.name = 'AnthropicProviderError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

async function providerError(response, apiKey) {
  const raw = (await response.text()).slice(0, MAX_ERROR_BODY_CHARS);
  let payload = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = null;
  }
  const requestId = responseRequestId(response, payload);
  const providerMessage = text(payload?.error?.message, MAX_ERROR_MESSAGE_CHARS);
  const message = redactSecret(
    providerMessage || `Anthropic API returned HTTP ${response.status}.`,
    apiKey,
  ).slice(0, MAX_ERROR_MESSAGE_CHARS);
  const code = text(payload?.error?.type, 120) || `anthropic_http_${response.status}`;
  return new AnthropicProviderError(code, message, response.status, requestId);
}

export async function runAnthropicMessage(env, input, deps = {}) {
  const apiKey = text(env?.ANTHROPIC_API_KEY, 4096);
  if (!apiKey) {
    throw new AnthropicProviderError(
      'provider_not_configured',
      'Anthropic provider execution is not configured on the server.',
      503,
      null,
    );
  }

  const normalized = normalizeRequest(input);
  const fetchImpl = deps.fetchImpl || fetch;
  const now = deps.now || Date.now;
  const timeoutSignal = deps.timeoutSignal || ((milliseconds) => AbortSignal.timeout(milliseconds));
  const startedAtMs = now();
  let response;

  try {
    response = await fetchImpl(ANTHROPIC_MESSAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: normalized.model,
        max_tokens: normalized.max_tokens,
        ...(normalized.system ? { system: normalized.system } : {}),
        messages: normalized.messages,
      }),
      signal: timeoutSignal(normalized.timeout_ms),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      throw new AnthropicProviderError('provider_timeout', 'Anthropic request timed out.', 504, null);
    }
    throw new AnthropicProviderError('provider_transport_error', 'Anthropic request failed.', 502, null);
  }

  if (!response.ok) throw await providerError(response, apiKey);

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new AnthropicProviderError(
      'provider_response_invalid',
      'Anthropic returned a non-JSON success response.',
      502,
      responseRequestId(response, null),
    );
  }

  if (!payload || payload.type !== 'message' || payload.role !== 'assistant' || typeof payload.id !== 'string') {
    throw new AnthropicProviderError(
      'provider_response_invalid',
      'Anthropic returned an invalid Messages response.',
      502,
      responseRequestId(response, payload),
    );
  }

  const completedAtMs = now();
  const extracted = extractTextBlocks(payload.content);
  return Object.freeze({
    provider: ANTHROPIC_PROVIDER,
    api: 'messages',
    api_version: ANTHROPIC_API_VERSION,
    endpoint: ANTHROPIC_MESSAGES_ENDPOINT,
    request_id: responseRequestId(response, payload),
    provider_message_id: text(payload.id, 240),
    requested_model: normalized.model,
    resolved_model: text(payload.model, 160) || normalized.model,
    stop_reason: text(payload.stop_reason, 80) || null,
    output_text: extracted.outputText,
    content_types: Object.freeze(extracted.contentTypes),
    usage: Object.freeze({
      input_tokens: safeInteger(payload.usage?.input_tokens),
      output_tokens: safeInteger(payload.usage?.output_tokens),
    }),
    latency_ms: Math.max(0, completedAtMs - startedAtMs),
    observed_at: new Date(completedAtMs).toISOString(),
    provenance_locked: true,
  });
}
