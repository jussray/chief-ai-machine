export const PROVIDER_INTEGRATION_STATES = Object.freeze([
  'ABSENT',
  'PRESENT',
  'INTEGRATED',
  'VERIFIED',
  'DEGRADED',
]);

const MAX_RESPONSE_BYTES = 64 * 1024;
const TIMEOUT_MS = 60_000;

const PROVIDERS = Object.freeze({
  openai: {
    key: 'OPENAI_API_KEY',
    model: 'CHIEF_OPENAI_MODEL',
    defaultModel: 'gpt-5.6-sol',
    url: 'https://api.openai.com/v1/responses',
  },
  anthropic: {
    key: 'ANTHROPIC_API_KEY',
    model: 'CHIEF_ANTHROPIC_MODEL',
    defaultModel: 'claude-sonnet-5',
    url: 'https://api.anthropic.com/v1/messages',
  },
  muse: {
    key: 'MODEL_API_KEY',
    model: 'CHIEF_MUSE_MODEL',
    defaultModel: 'muse-spark-1.3',
    url: 'https://api.meta.ai/v1/responses',
  },
});

function configFor(env, provider) {
  const config = PROVIDERS[provider];
  if (!config) throw new Error('unsupported provider');
  const key = typeof env?.[config.key] === 'string' ? env[config.key].trim() : '';
  const configuredModel = typeof env?.[config.model] === 'string' ? env[config.model].trim() : '';
  return {
    ...config,
    key,
    modelName: configuredModel || config.defaultModel,
  };
}

export function chiefProviderStates(env = {}) {
  return Object.fromEntries(Object.keys(PROVIDERS).map((provider) => {
    const config = configFor(env, provider);
    return [provider, {
      state: config.key ? 'INTEGRATED' : 'ABSENT',
      model: config.modelName,
      secretName: config.key,
    }];
  }));
}

async function readBoundedText(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    try { await response.body?.cancel(); } catch {}
    throw new Error('provider response too large');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('provider response too large');
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

function safeId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(id) ? id : null;
}

function textFromOpenAI(body) {
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(body.output) ? body.output : []) {
    for (const block of Array.isArray(item?.content) ? item.content : []) {
      if (typeof block?.text === 'string' && block.text.trim()) parts.push(block.text.trim());
    }
  }
  return parts.join('\n').trim();
}

function textFromAnthropic(body) {
  return (Array.isArray(body.content) ? body.content : [])
    .filter((block) => block?.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n');
}

function textFromMuse(body) {
  if (typeof body.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const parts = [];
  for (const item of Array.isArray(body.output) ? body.output : []) {
    for (const block of Array.isArray(item?.content) ? item.content : []) {
      if (block?.type === 'output_text' && typeof block.text === 'string' && block.text.trim()) parts.push(block.text.trim());
    }
  }
  return parts.join('\n').trim();
}

export async function invokeChiefProvider(env, input, fetchImpl = fetch) {
  const provider = String(input?.provider || '').trim().toLowerCase();
  const prompt = String(input?.prompt || '').trim();
  const sensitivity = String(input?.sensitivity || 'standard').trim().toLowerCase();
  if (!prompt || prompt.length > 24_000) throw new Error('prompt must be 1..24000 characters');
  if (sensitivity === 'restricted') throw new Error('restricted context is not authorized for external providers');

  const config = configFor(env, provider);
  if (!config.key) throw new Error(`${provider} provider is not configured`);

  let headers;
  let body;
  if (provider === 'anthropic') {
    headers = {
      'x-api-key': config.key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
    body = {
      model: config.modelName,
      max_tokens: 2_000,
      messages: [{ role: 'user', content: prompt }],
    };
  } else {
    headers = {
      authorization: `Bearer ${config.key}`,
      'content-type': 'application/json',
    };
    body = {
      model: config.modelName,
      input: prompt,
      store: false,
      max_output_tokens: 2_000,
    };
  }

  let response;
  try {
    response = await fetchImpl(config.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error(`${provider} provider request failed`);
  }

  if (!response.ok) {
    try { await response.body?.cancel(); } catch {}
    throw new Error(`${provider} provider failed with HTTP ${response.status}`);
  }

  const raw = await readBoundedText(response);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error(`${provider} provider returned invalid JSON`); }
  const responseId = safeId(parsed?.id);
  if (!responseId) throw new Error(`${provider} provider returned invalid response identity`);

  const text = provider === 'anthropic'
    ? textFromAnthropic(parsed)
    : provider === 'muse'
      ? textFromMuse(parsed)
      : textFromOpenAI(parsed);
  if (!text) throw new Error(`${provider} provider returned no usable text`);

  return {
    provider,
    model: config.modelName,
    responseId,
    evidenceRef: `provider:${provider === 'muse' ? 'meta' : provider}:${responseId}`,
    state: 'INTEGRATED',
    authority: 'none',
    text,
  };
}
