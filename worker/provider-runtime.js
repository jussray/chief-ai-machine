export const PROVIDER_INTEGRATION_STATES = Object.freeze([
  'ABSENT',
  'PRESENT',
  'INTEGRATED',
  'VERIFIED',
  'DEGRADED',
]);

const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_BATCH_RESULTS_BYTES = 1024 * 1024;
const MAX_BATCH_RESULTS_ITEMS = 100;
const TIMEOUT_MS = 60_000;
const ANTHROPIC_ADVISOR_BETA = 'advisor-tool-2026-03-01';
const ANTHROPIC_FAST_BETA = 'fast-mode-2026-02-01';
const ANTHROPIC_BATCH_URL = 'https://api.anthropic.com/v1/messages/batches';
const ANTHROPIC_FAST_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-opus-4-8']);
const DEFAULT_ANTHROPIC_ADVISOR_MODEL = 'claude-fable-5';
const ANTHROPIC_ADVISOR_SYSTEM = 'You have access to an advisor tool backed by a stronger reviewer model. Call advisor before substantive implementation work, give the advice serious weight, then implement. Orientation and reading are not substantive work. Advisor guidance does not grant execution authority.';

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

function anthropicCacheTtl(value) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized === '5m' || normalized === '1h' ? normalized : null;
}

function enabled(value) {
  return typeof value === 'string' && value.trim().toLowerCase() === 'true';
}

function appendAnthropicBeta(headers, beta) {
  const existing = String(headers['anthropic-beta'] || '').trim();
  const values = new Set(
    [existing, beta]
      .filter(Boolean)
      .flatMap((value) => value.split(',').map((entry) => entry.trim()).filter(Boolean)),
  );
  return { ...headers, 'anthropic-beta': [...values].join(',') };
}

function fastModeRequested(env, input, modelName) {
  const requested = enabled(env.CHIEF_ANTHROPIC_FAST_MODE_ENABLED) && input?.useFast === true;
  if (!requested) return false;
  if (!ANTHROPIC_FAST_MODELS.has(modelName)) {
    throw new Error('Anthropic fast mode requires Claude Opus 5.5, Opus 5, or Opus 4.8');
  }
  return true;
}

function advisorTool(env, input, cacheTtl) {
  const requested = enabled(env.CHIEF_ANTHROPIC_ADVISOR_ENABLED) && input?.useAdvisor === true;
  if (!requested) return { requested: false, tool: null };
  const advisorModel = String(env.CHIEF_ANTHROPIC_ADVISOR_MODEL || '').trim() || DEFAULT_ANTHROPIC_ADVISOR_MODEL;
  const advisorCacheEnabled = enabled(env.CHIEF_ANTHROPIC_ADVISOR_CACHE_ENABLED);
  return {
    requested: true,
    tool: {
      type: 'advisor_20260301',
      name: 'advisor',
      model: advisorModel,
      max_uses: 2,
      max_tokens: 2_048,
      ...(advisorCacheEnabled ? { caching: { type: 'ephemeral', ttl: cacheTtl || '5m' } } : {}),
    },
  };
}

function safeBatchId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && id.length <= 200 && /^[A-Za-z0-9._:-]+$/.test(id) ? id : null;
}

function safeCustomId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return /^[A-Za-z0-9_-]{1,64}$/.test(id) ? id : null;
}

function usageNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function anthropicOptimizationReceipt(body, { advisorRequested, cacheTtl, fastRequested }) {
  const usage = body && typeof body.usage === 'object' && body.usage ? body.usage : {};
  const content = Array.isArray(body?.content) ? body.content : [];
  const iterations = Array.isArray(usage.iterations) ? usage.iterations : [];
  const advisorIterations = iterations.filter((entry) => entry?.type === 'advisor_message');
  return {
    advisorRequested,
    advisorObserved: content.some((block) => block?.type === 'advisor_tool_result'),
    advisorCalls: advisorIterations.length,
    advisorInputTokens: advisorIterations.reduce((sum, entry) => sum + usageNumber(entry?.input_tokens), 0),
    advisorOutputTokens: advisorIterations.reduce((sum, entry) => sum + usageNumber(entry?.output_tokens), 0),
    cacheTtl,
    fastRequested,
    speedObserved: typeof usage.speed === 'string' ? usage.speed : 'unknown',
    cacheReadInputTokens: usageNumber(usage.cache_read_input_tokens),
    cacheCreationInputTokens: usageNumber(usage.cache_creation_input_tokens),
    uncachedInputTokens: usageNumber(usage.input_tokens),
  };
}

export function chiefProviderStates(env = {}) {
  return Object.fromEntries(Object.keys(PROVIDERS).map((provider) => {
    const config = configFor(env, provider);
    return [provider, {
      state: config.key ? 'INTEGRATED' : 'ABSENT',
      model: config.modelName,
      secretName: PROVIDERS[provider].key,
    }];
  }));
}

async function readBoundedText(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) {
    try { await response.body?.cancel(); } catch { /* best-effort cancellation */ }
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
  if (body.status !== 'completed') {
    throw new Error('openai provider returned a non-completed response');
  }
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


export async function createChiefAnthropicBatch(env, input, fetchImpl = fetch) {
  if (!enabled(env.CHIEF_ANTHROPIC_BATCH_ENABLED)) {
    throw new Error('Anthropic batch processing is disabled');
  }
  const config = configFor(env, 'anthropic');
  if (!config.key) throw new Error('anthropic provider is not configured');

  const requests = Array.isArray(input?.requests) ? input.requests : [];
  if (requests.length === 0 || requests.length > 100) {
    throw new Error('batch requests must contain 1..100 items');
  }

  let includeAdvisorBeta = false;
  const compiled = requests.map((request) => {
    if (request?.useFast === true) throw new Error('Anthropic batch processing does not support fast mode');
    const customId = safeCustomId(request?.customId);
    if (!customId) throw new Error('batch customId must match ^[a-zA-Z0-9_-]{1,64}$');
    const prompt = String(request?.prompt || '').trim();
    const stableContext = String(request?.stableContext || '').trim();
    if (!prompt || prompt.length > 24_000) throw new Error('batch prompt must be 1..24000 characters');
    if (stableContext.length > 120_000) throw new Error('batch stableContext must be <=120000 characters');

    const cacheTtl = anthropicCacheTtl(request?.cacheTtl || env.CHIEF_ANTHROPIC_BATCH_CACHE_TTL || '1h');
    const advisor = advisorTool(env, request, cacheTtl);
    includeAdvisorBeta = includeAdvisorBeta || advisor.requested;

    const system = [];
    if (advisor.requested) system.push({ type: 'text', text: ANTHROPIC_ADVISOR_SYSTEM });
    if (stableContext) {
      system.push({
        type: 'text',
        text: stableContext,
        ...(cacheTtl ? { cache_control: { type: 'ephemeral', ttl: cacheTtl } } : {}),
      });
    }

    return {
      custom_id: customId,
      params: {
        model: config.modelName,
        max_tokens: Number.isInteger(request?.maxTokens) && request.maxTokens >= 1
          ? Math.min(request.maxTokens, 128_000)
          : 2_000,
        ...(system.length > 0 ? { system } : {}),
        messages: [{ role: 'user', content: prompt }],
        ...(advisor.tool ? { tools: [advisor.tool] } : {}),
      },
    };
  });

  let headers = {
    'x-api-key': config.key,
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
  };
  if (includeAdvisorBeta) headers = appendAnthropicBeta(headers, ANTHROPIC_ADVISOR_BETA);

  let response;
  try {
    response = await fetchImpl(ANTHROPIC_BATCH_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({ requests: compiled }),
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error('anthropic batch request failed');
  }
  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* best-effort cancellation */ }
    throw new Error(`anthropic batch failed with HTTP ${response.status}`);
  }
  const raw = await readBoundedText(response);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('anthropic batch returned invalid JSON'); }
  const batchId = safeBatchId(parsed?.id);
  if (!batchId || parsed?.type !== 'message_batch') throw new Error('anthropic batch returned invalid identity');

  return {
    provider: 'anthropic',
    mode: 'batch',
    batchId,
    status: String(parsed.processing_status || 'unknown'),
    requestCounts: parsed.request_counts || null,
    evidenceRef: `provider:anthropic-batch:${batchId}`,
    authority: 'none',
  };
}

export async function getChiefAnthropicBatch(env, batchId, fetchImpl = fetch) {
  const config = configFor(env, 'anthropic');
  if (!config.key) throw new Error('anthropic provider is not configured');
  const safeId = safeBatchId(batchId);
  if (!safeId) throw new Error('invalid Anthropic batch id');
  let response;
  try {
    response = await fetchImpl(`${ANTHROPIC_BATCH_URL}/${encodeURIComponent(safeId)}`, {
      method: 'GET',
      headers: {
        'x-api-key': config.key,
        'anthropic-version': '2023-06-01',
      },
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error('anthropic batch status request failed');
  }
  if (!response.ok) throw new Error(`anthropic batch status failed with HTTP ${response.status}`);
  const raw = await readBoundedText(response);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('anthropic batch status returned invalid JSON'); }
  if (safeBatchId(parsed?.id) !== safeId || parsed?.type !== 'message_batch') {
    throw new Error('anthropic batch status returned invalid identity');
  }
  return {
    provider: 'anthropic',
    mode: 'batch',
    batchId: safeId,
    status: String(parsed.processing_status || 'unknown'),
    requestCounts: parsed.request_counts || null,
    resultsUrlPresent: typeof parsed.results_url === 'string' && Boolean(parsed.results_url),
    evidenceRef: `provider:anthropic-batch:${safeId}`,
    authority: 'none',
  };
}

async function readBoundedBatchResults(response) {
  if (!response.body) return [];
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BATCH_RESULTS_BYTES) {
        await reader.cancel();
        throw new Error('anthropic batch results exceeded bounded response size');
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > MAX_BATCH_RESULTS_ITEMS) {
    throw new Error('anthropic batch results exceeded bounded item count');
  }
  return lines.map((line) => {
    let item;
    try { item = JSON.parse(line); } catch { throw new Error('anthropic batch results returned invalid JSONL'); }
    if (!safeCustomId(item?.custom_id)) throw new Error('anthropic batch result returned invalid custom_id');
    if (!['succeeded', 'errored', 'canceled', 'expired'].includes(item?.result?.type)) {
      throw new Error('anthropic batch result returned invalid result type');
    }
    return item;
  });
}

export async function getChiefAnthropicBatchResults(env, batchId, fetchImpl = fetch) {
  const config = configFor(env, 'anthropic');
  if (!config.key) throw new Error('anthropic provider is not configured');
  const safeId = safeBatchId(batchId);
  if (!safeId) throw new Error('invalid Anthropic batch id');
  let response;
  try {
    response = await fetchImpl(`${ANTHROPIC_BATCH_URL}/${encodeURIComponent(safeId)}/results`, {
      method: 'GET',
      headers: {
        'x-api-key': config.key,
        'anthropic-version': '2023-06-01',
      },
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error('anthropic batch results request failed');
  }
  if (!response.ok) throw new Error(`anthropic batch results failed with HTTP ${response.status}`);
  const results = await readBoundedBatchResults(response);
  return {
    provider: 'anthropic',
    mode: 'batch',
    batchId: safeId,
    results,
    evidenceRef: `provider:anthropic-batch:${safeId}`,
    authority: 'none',
  };
}

export async function cancelChiefAnthropicBatch(env, batchId, fetchImpl = fetch) {
  const config = configFor(env, 'anthropic');
  if (!config.key) throw new Error('anthropic provider is not configured');
  const safeId = safeBatchId(batchId);
  if (!safeId) throw new Error('invalid Anthropic batch id');
  let response;
  try {
    response = await fetchImpl(`${ANTHROPIC_BATCH_URL}/${encodeURIComponent(safeId)}/cancel`, {
      method: 'POST',
      headers: {
        'x-api-key': config.key,
        'anthropic-version': '2023-06-01',
      },
      redirect: 'error',
      signal: globalThis.AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error('anthropic batch cancel request failed');
  }
  if (!response.ok) throw new Error(`anthropic batch cancel failed with HTTP ${response.status}`);
  const raw = await readBoundedText(response);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('anthropic batch cancel returned invalid JSON'); }
  if (safeBatchId(parsed?.id) !== safeId || parsed?.type !== 'message_batch') {
    throw new Error('anthropic batch cancel returned invalid identity');
  }
  return {
    provider: 'anthropic',
    mode: 'batch',
    batchId: safeId,
    status: String(parsed.processing_status || 'unknown'),
    evidenceRef: `provider:anthropic-batch:${safeId}`,
    authority: 'none',
  };
}

export async function invokeChiefProvider(env, input, fetchImpl = fetch) {
  const provider = String(input?.provider || '').trim().toLowerCase();
  const prompt = String(input?.prompt || '').trim();
  const stableContext = String(input?.stableContext || '').trim();
  const sensitivity = String(input?.sensitivity || 'standard').trim().toLowerCase();
  if (!prompt || prompt.length > 24_000) throw new Error('prompt must be 1..24000 characters');
  if (stableContext.length > 120_000) throw new Error('stableContext must be <=120000 characters');
  if (sensitivity === 'restricted') throw new Error('restricted context is not authorized for external providers');

  const config = configFor(env, provider);
  if (!config.key) throw new Error(`${provider} provider is not configured`);

  let headers;
  let body;
  let anthropicOptions = null;
  if (provider === 'anthropic') {
    const cacheTtl = anthropicCacheTtl(env.CHIEF_ANTHROPIC_CACHE_TTL);
    const advisor = advisorTool(env, input, cacheTtl);
    const fastRequested = fastModeRequested(env, input, config.modelName);
    const system = [];
    if (advisor.requested) {
      system.push({ type: 'text', text: ANTHROPIC_ADVISOR_SYSTEM });
    }
    if (stableContext) {
      system.push({
        type: 'text',
        text: stableContext,
        ...(cacheTtl ? { cache_control: { type: 'ephemeral', ttl: cacheTtl } } : {}),
      });
    } else if (cacheTtl && system.length > 0) {
      system[system.length - 1] = {
        ...system[system.length - 1],
        cache_control: { type: 'ephemeral', ttl: cacheTtl },
      };
    }

    headers = {
      'x-api-key': config.key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    };
    if (advisor.requested) headers = appendAnthropicBeta(headers, ANTHROPIC_ADVISOR_BETA);
    if (fastRequested) headers = appendAnthropicBeta(headers, ANTHROPIC_FAST_BETA);
    body = {
      model: config.modelName,
      max_tokens: 2_000,
      ...(fastRequested ? { speed: 'fast' } : {}),
      ...(system.length > 0 ? { system } : {}),
      messages: [{ role: 'user', content: prompt }],
      ...(advisor.tool ? { tools: [advisor.tool] } : {}),
    };
    anthropicOptions = { advisorRequested: advisor.requested, cacheTtl, fastRequested };
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
      signal: globalThis.AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new Error(`${provider} provider request failed`);
  }

  if (!response.ok) {
    try { await response.body?.cancel(); } catch { /* best-effort cancellation */ }
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
    ...(provider === 'anthropic' && anthropicOptions
      ? { optimization: anthropicOptimizationReceipt(parsed, anthropicOptions) }
      : {}),
  };
}
