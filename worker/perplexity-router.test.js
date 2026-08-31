import { describe, expect, it, vi } from 'vitest';
import {
  PERPLEXITY_ROUTER_BASE_URL,
  PERPLEXITY_ROUTER_MODELS_URL,
  PerplexityRouterError,
  createPerplexityRouter,
  parseRetryAfterMs,
} from './perplexity-router.js';

const API_KEY = 'test-key-not-a-real-secret';

function modelResponse(ids = ['provider/model-one']) {
  return new Response(JSON.stringify({
    object: 'list',
    data: ids.map((id) => ({ id, object: 'model' })),
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function clientFactory(create) {
  return vi.fn((options) => ({
    options,
    chat: { completions: { create } },
  }));
}

describe('Perplexity Router', () => {
  it('requires PERPLEXITY_API_KEY without exposing a fallback credential', () => {
    expect(() => createPerplexityRouter({ env: {}, fetchImpl: vi.fn() }))
      .toThrowError(PerplexityRouterError);
  });

  it('lists the exact key-scoped Router allowlist endpoint', async () => {
    const fetchImpl = vi.fn(async () => modelResponse());
    const factory = clientFactory(vi.fn());
    const router = createPerplexityRouter({
      env: { PERPLEXITY_API_KEY: API_KEY },
      fetchImpl,
      openAIClientFactory: factory,
    });

    await expect(router.listModels()).resolves.toEqual([
      { id: 'provider/model-one', object: 'model' },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      PERPLEXITY_ROUTER_MODELS_URL,
      expect.objectContaining({
        method: 'GET',
        headers: { Authorization: `Bearer ${API_KEY}` },
      }),
    );
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({
      apiKey: API_KEY,
      baseURL: PERPLEXITY_ROUTER_BASE_URL,
      maxRetries: 0,
    }));
  });

  it('rejects an unlisted model before sending a completion', async () => {
    const create = vi.fn();
    const router = createPerplexityRouter({
      env: { PERPLEXITY_API_KEY: API_KEY },
      fetchImpl: vi.fn(async () => modelResponse(['provider/allowed'])),
      openAIClientFactory: clientFactory(create),
    });

    await expect(router.chat.completions.create({
      model: 'provider/not-allowed',
      messages: [{ role: 'user', content: 'hello' }],
    })).rejects.toMatchObject({
      code: 'perplexity_model_not_allowed',
      status: 400,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('uses the OpenAI-compatible schema and enforces one choices entry', async () => {
    const create = vi.fn(async () => ({
      object: 'chat.completion',
      choices: [{ index: 0, message: { role: 'assistant', content: 'OK' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }));
    const router = createPerplexityRouter({
      env: { PERPLEXITY_API_KEY: API_KEY },
      fetchImpl: vi.fn(async () => modelResponse(['provider/allowed'])),
      openAIClientFactory: clientFactory(create),
    });

    const completion = await router.chat.completions.create({
      model: 'provider/allowed',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(completion.choices).toHaveLength(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      model: 'provider/allowed',
      messages: [{ role: 'user', content: 'hello' }],
    }));
  });

  it('passes Chat Completions streaming options through unchanged', async () => {
    const stream = { async *[Symbol.asyncIterator]() {} };
    const create = vi.fn(async () => stream);
    const router = createPerplexityRouter({
      env: { PERPLEXITY_API_KEY: API_KEY },
      fetchImpl: vi.fn(async () => modelResponse(['provider/allowed'])),
      openAIClientFactory: clientFactory(create),
    });

    const result = await router.chat.completions.create({
      model: 'provider/allowed',
      stream: true,
      stream_options: { include_usage: true },
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(result).toBe(stream);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({
      stream: true,
      stream_options: { include_usage: true },
    }));
  });

  it('honors Retry-After on model-catalog 429s', async () => {
    const sleep = vi.fn(async () => {});
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('', {
        status: 429,
        headers: { 'Retry-After': '2' },
      }))
      .mockResolvedValueOnce(modelResponse());
    const router = createPerplexityRouter({
      env: { PERPLEXITY_API_KEY: API_KEY },
      fetchImpl,
      openAIClientFactory: clientFactory(vi.fn()),
      sleep,
    });

    await router.listModels();
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('parses HTTP-date Retry-After values', () => {
    const now = Date.parse('2026-08-30T20:00:00Z');
    const headers = new globalThis.Headers({
      'Retry-After': 'Sun, 30 Aug 2026 20:00:03 GMT',
    });
    expect(parseRetryAfterMs(headers, now)).toBe(3000);
  });
});
