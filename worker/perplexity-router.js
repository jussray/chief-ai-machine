import OpenAI from 'openai';

export const PERPLEXITY_ROUTER_BASE_URL = 'https://api.perplexity.ai/router/v1';
export const PERPLEXITY_ROUTER_MODELS_URL = `${PERPLEXITY_ROUTER_BASE_URL}/models`;

const MAX_RATE_LIMIT_RETRIES = 2;

/**
 * @typedef {{ PERPLEXITY_API_KEY?: string }} RouterEnv
 * @typedef {{ chat: { completions: { create: (request: any) => Promise<any> } } }} RouterClient
 * @typedef {{
 *   env?: RouterEnv,
 *   fetchImpl?: (input: URL | RequestInfo, init?: RequestInit) => Promise<Response>,
 *   openAIClientFactory?: (options: any) => RouterClient,
 *   sleep?: (ms: number) => Promise<void>,
 * }} CreatePerplexityRouterOptions
 */

export class PerplexityRouterError extends Error {
  constructor(message, { code = 'perplexity_router_error', status = null, retryAfterMs = null } = {}) {
    super(message);
    this.name = 'PerplexityRouterError';
    this.code = code;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function resolveApiKey(env) {
  const apiKey = env?.PERPLEXITY_API_KEY;
  if (typeof apiKey !== 'string' || !apiKey.trim()) {
    throw new PerplexityRouterError(
      'PERPLEXITY_API_KEY is required for Perplexity Router requests.',
      { code: 'perplexity_api_key_missing' },
    );
  }
  return apiKey.trim();
}

function getHeader(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const lowerName = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);
  return entry?.[1] ?? null;
}

export function parseRetryAfterMs(headers, now = Date.now()) {
  const value = getHeader(headers, 'retry-after');
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1000);

  const retryAt = Date.parse(value);
  if (Number.isNaN(retryAt)) return null;
  return Math.max(0, retryAt - now);
}

function fallbackRetryDelayMs(attempt) {
  const exponential = 500 * (2 ** attempt);
  const jitter = Math.floor(Math.random() * 250);
  return exponential + jitter;
}

function wait(ms) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function classifyStatus(status) {
  if (status === 401) return 'perplexity_authentication_error';
  if (status === 402) return 'perplexity_usage_tier_error';
  if (status === 429) return 'perplexity_rate_limited';
  return 'perplexity_router_http_error';
}

function statusMessage(status) {
  if (status === 401) return 'Perplexity rejected PERPLEXITY_API_KEY.';
  if (status === 402) return 'The selected model is unavailable for this Perplexity usage tier.';
  if (status === 429) return 'Perplexity Router is rate limited or the selected model is temporarily overloaded.';
  return `Perplexity Router request failed with HTTP ${status}.`;
}

async function fetchJsonWithRateLimitRetry(url, init, { fetchImpl, sleep }) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    const response = await fetchImpl(url, init);

    if (response.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
      const retryAfterMs = parseRetryAfterMs(response.headers);
      await sleep(retryAfterMs ?? fallbackRetryDelayMs(attempt));
      continue;
    }

    if (!response.ok) {
      throw new PerplexityRouterError(statusMessage(response.status), {
        code: classifyStatus(response.status),
        status: response.status,
        retryAfterMs: parseRetryAfterMs(response.headers),
      });
    }

    return response.json();
  }

  throw new PerplexityRouterError('Perplexity Router retry budget was exhausted.');
}

function validateModelCatalog(payload) {
  if (payload?.object !== 'list' || !Array.isArray(payload.data)) {
    throw new PerplexityRouterError('Perplexity Router returned an invalid model catalog shape.', {
      code: 'perplexity_model_catalog_shape_error',
    });
  }

  return payload.data.filter((model) => (
    model && typeof model.id === 'string' && model.id.includes('/')
  ));
}

function validateRequestedModel(model, catalog) {
  if (typeof model !== 'string' || !model.trim()) {
    throw new PerplexityRouterError('A Router model id from GET /router/v1/models is required.', {
      code: 'perplexity_model_required',
    });
  }

  const requested = model.trim();
  if (!catalog.some((entry) => entry.id === requested)) {
    throw new PerplexityRouterError(
      `Router model ${requested} is not present in this API key's live catalog.`,
      { code: 'perplexity_model_not_allowed', status: 400 },
    );
  }
  return requested;
}

async function createWithRateLimitRetry(client, request, sleep) {
  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt += 1) {
    try {
      return await client.chat.completions.create(request);
    } catch (error) {
      const status = Number(error?.status) || null;
      const retryAfterMs = parseRetryAfterMs(error?.headers);
      if (status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        await sleep(retryAfterMs ?? fallbackRetryDelayMs(attempt));
        continue;
      }
      if (status) {
        throw new PerplexityRouterError(statusMessage(status), {
          code: classifyStatus(status),
          status,
          retryAfterMs,
        });
      }
      throw error;
    }
  }

  throw new PerplexityRouterError('Perplexity Router retry budget was exhausted.');
}

/**
 * @param {CreatePerplexityRouterOptions} [options]
 */
export function createPerplexityRouter(options = {}) {
  const {
    env,
    fetchImpl = globalThis.fetch,
    openAIClientFactory = (clientOptions) => new OpenAI(clientOptions),
    sleep = wait,
  } = options;

  const apiKey = resolveApiKey(env);
  if (typeof fetchImpl !== 'function') {
    throw new PerplexityRouterError('A fetch implementation is required for the Router model catalog.');
  }

  const client = openAIClientFactory({
    apiKey,
    baseURL: PERPLEXITY_ROUTER_BASE_URL,
    maxRetries: 0,
  });

  async function listModels() {
    const payload = await fetchJsonWithRateLimitRetry(
      PERPLEXITY_ROUTER_MODELS_URL,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
      { fetchImpl, sleep },
    );
    return validateModelCatalog(payload);
  }

  async function chatCompletionsCreate(request) {
    const catalog = await listModels();
    const model = validateRequestedModel(request?.model, catalog);
    const completion = await createWithRateLimitRetry(client, { ...request, model }, sleep);

    if (!request?.stream && (!Array.isArray(completion?.choices) || completion.choices.length !== 1)) {
      throw new PerplexityRouterError(
        'Perplexity Chat Completions must return exactly one choices entry.',
        { code: 'perplexity_response_shape_error' },
      );
    }

    return completion;
  }

  return Object.freeze({
    listModels,
    chat: Object.freeze({
      completions: Object.freeze({
        create: chatCompletionsCreate,
      }),
    }),
  });
}
