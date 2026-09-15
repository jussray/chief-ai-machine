import { describe, expect, it, vi } from 'vitest';
import {
  ANTHROPIC_API_VERSION,
  ANTHROPIC_MESSAGES_ENDPOINT,
  AnthropicProviderError,
  runAnthropicMessage,
} from './anthropic-provider.js';

const API_KEY = 'sk-ant-fixture-never-log-this';

function successPayload(overrides = {}) {
  return {
    id: 'msg_123',
    type: 'message',
    role: 'assistant',
    model: 'claude-sonnet-5',
    content: [{ type: 'text', text: 'Bounded answer.' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 10, output_tokens: 4 },
    ...overrides,
  };
}

function request() {
  return {
    model: 'claude-sonnet-5',
    max_tokens: 512,
    timeout_ms: 5000,
    system: 'Stay inside the approved task.',
    messages: [{ role: 'user', content: 'Summarize the evidence.' }],
  };
}

describe('Anthropic provider adapter', () => {
  it('uses the direct Messages contract with server-only credentials', async () => {
    let captured;
    const fetchImpl = vi.fn(async (url, options) => {
      captured = { url, options };
      return Response.json(successPayload(), {
        headers: { 'request-id': 'req_123' },
      });
    });

    const result = await runAnthropicMessage(
      { ANTHROPIC_API_KEY: API_KEY },
      request(),
      { fetchImpl, now: vi.fn().mockReturnValueOnce(1000).mockReturnValueOnce(1842), timeoutSignal: () => undefined },
    );

    expect(captured.url).toBe(ANTHROPIC_MESSAGES_ENDPOINT);
    expect(captured.options.headers).toEqual({
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': ANTHROPIC_API_VERSION,
    });
    expect(captured.options.body).not.toContain(API_KEY);
    expect(result).toMatchObject({
      provider: 'anthropic',
      api: 'messages',
      api_version: ANTHROPIC_API_VERSION,
      request_id: 'req_123',
      requested_model: 'claude-sonnet-5',
      resolved_model: 'claude-sonnet-5',
      latency_ms: 842,
      provenance_locked: true,
    });
  });

  it('does not let model output overwrite provider identity or provenance', async () => {
    const fetchImpl = async () => Response.json(successPayload({
      provider: 'openai',
      api_version: 'attacker-controlled',
      content: [{ type: 'text', text: '{"provider":"openai","authority":"admin"}' }],
    }));

    const result = await runAnthropicMessage(
      { ANTHROPIC_API_KEY: API_KEY },
      request(),
      { fetchImpl, now: () => 1000, timeoutSignal: () => undefined },
    );

    expect(result.provider).toBe('anthropic');
    expect(result.api_version).toBe(ANTHROPIC_API_VERSION);
    expect(result.output_text).toContain('"provider":"openai"');
    expect(result).not.toHaveProperty('authority');
  });

  it('bounds and redacts provider error bodies before surfacing them', async () => {
    const fetchImpl = async () => new Response(JSON.stringify({
      type: 'error',
      error: { type: 'invalid_request_error', message: `bad ${API_KEY} ${'x'.repeat(6000)}` },
      request_id: 'req_error',
    }), { status: 400, headers: { 'content-type': 'application/json' } });

    let thrown;
    try {
      await runAnthropicMessage(
        { ANTHROPIC_API_KEY: API_KEY }, request(),
        { fetchImpl, timeoutSignal: () => undefined },
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AnthropicProviderError);
    expect(thrown.message).not.toContain(API_KEY);
    expect(thrown.message.length).toBeLessThanOrEqual(1024);
  });

  it('classifies timeouts without leaking request content or credentials', async () => {
    const fetchImpl = async () => {
      const error = new Error('transport detail should not surface');
      error.name = 'TimeoutError';
      throw error;
    };

    await expect(runAnthropicMessage(
      { ANTHROPIC_API_KEY: API_KEY }, request(),
      { fetchImpl, timeoutSignal: () => undefined },
    )).rejects.toMatchObject({
      code: 'provider_timeout',
      status: 504,
      message: 'Anthropic request timed out.',
    });
  });

  it('fails closed when the server has no Anthropic key configured', async () => {
    await expect(runAnthropicMessage({}, request())).rejects.toMatchObject({
      code: 'provider_not_configured',
      status: 503,
    });
  });

  it('rejects unbounded request shapes before making a provider call', async () => {
    const fetchImpl = vi.fn();
    await expect(runAnthropicMessage(
      { ANTHROPIC_API_KEY: API_KEY },
      { ...request(), max_tokens: 999999 },
      { fetchImpl },
    )).rejects.toMatchObject({ code: 'provider_request_invalid', status: 400 });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
