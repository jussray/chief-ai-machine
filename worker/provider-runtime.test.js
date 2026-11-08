import { describe, expect, it, vi } from 'vitest';
import {
  chiefProviderStates,
  createChiefAnthropicBatch,
  getChiefAnthropicBatchResults,
  invokeChiefProvider,
} from './provider-runtime.js';

const jsonResponse = (body) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

describe('Chief provider runtime', () => {
  it.each(['incomplete', 'failed', 'cancelled', 'queued', 'in_progress', undefined])(
    'rejects OpenAI status %s with partial text without retrying', async (status) => {
      const fetchMock = vi.fn(async () => jsonResponse({
        id: 'resp_partial', status, output_text: 'unfinished answer',
        error: { message: 'untrusted-provider-detail' },
      }));
      await expect(invokeChiefProvider({ OPENAI_API_KEY: 'test-key' }, {
        provider: 'openai', prompt: 'Challenge this architecture.',
      }, fetchMock)).rejects.toThrow('openai provider returned a non-completed response');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('reports provider integration without exposing secret values', () => {
    const states = chiefProviderStates({
      OPENAI_API_KEY: 'openai-secret-value',
      ANTHROPIC_API_KEY: 'anthropic-secret-value',
      MODEL_API_KEY: 'muse-secret-value',
    });
    expect(states.openai.state).toBe('INTEGRATED');
    expect(states.anthropic.state).toBe('INTEGRATED');
    expect(states.muse.state).toBe('INTEGRATED');
    expect(JSON.stringify(states)).not.toContain('secret-value');
  });

  it('invokes OpenAI and records model plus provider identity', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      expect(init.headers.authorization).toBe('Bearer openai-key');
      expect(String(init.body)).not.toContain('openai-key');
      return jsonResponse({ id: 'resp_openai_1', status: 'completed', output_text: 'OpenAI result' });
    });
    const result = await invokeChiefProvider({ OPENAI_API_KEY: 'openai-key' }, {
      provider: 'openai',
      prompt: 'Challenge this architecture.',
    }, fetchMock);
    expect(result).toMatchObject({
      provider: 'openai',
      model: 'gpt-5.6-sol',
      evidenceRef: 'provider:openai:resp_openai_1',
      authority: 'none',
      text: 'OpenAI result',
    });
  });

  it('invokes Anthropic without serializing its key', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
      expect(init.headers['x-api-key']).toBe('anthropic-key');
      expect(String(init.body)).not.toContain('anthropic-key');
      return jsonResponse({
        id: 'msg_claude_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Claude result' }],
      });
    });
    const result = await invokeChiefProvider({ ANTHROPIC_API_KEY: 'anthropic-key' }, {
      provider: 'anthropic',
      prompt: 'Find the weakest assumption.',
    }, fetchMock);
    expect(result.evidenceRef).toBe('provider:anthropic:msg_claude_1');
    expect(result.model).toBe('claude-sonnet-5');
  });

  it('invokes Muse and rejects restricted context', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      id: 'resp_muse_1',
      status: 'completed',
      output_text: 'Muse result',
    }));
    const result = await invokeChiefProvider({ MODEL_API_KEY: 'muse-key' }, {
      provider: 'muse',
      prompt: 'Challenge provider drift.',
    }, fetchMock);
    expect(result.evidenceRef).toBe('provider:meta:resp_muse_1');
    await expect(invokeChiefProvider({ MODEL_API_KEY: 'muse-key' }, {
      provider: 'muse',
      prompt: 'private',
      sensitivity: 'restricted',
    }, fetchMock)).rejects.toThrow(/restricted context/);
  });

  it('bounds advisor spend and keeps advisor-side caching off unless explicitly enabled', async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const payload = JSON.parse(String(init.body));
      expect(init.headers['anthropic-beta']).toContain('advisor-tool-2026-03-01');
      expect(payload.tools).toEqual([
        expect.objectContaining({
          type: 'advisor_20260301',
          name: 'advisor',
          model: 'claude-fable-5',
          max_uses: 2,
          max_tokens: 2048,
        }),
      ]);
      expect(payload.tools[0].caching).toBeUndefined();
      return jsonResponse({
        id: 'msg_advisor_1',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'advisor_tool_result', tool_use_id: 'advisor_1', content: { type: 'advisor_redacted_result', encrypted_content: 'opaque' } },
          { type: 'text', text: 'Claude result' },
        ],
        usage: {
          input_tokens: 25,
          cache_creation_input_tokens: 800,
          cache_read_input_tokens: 0,
          output_tokens: 30,
          iterations: [
            { type: 'message', input_tokens: 25, output_tokens: 10 },
            { type: 'advisor_message', model: 'claude-fable-5', input_tokens: 200, output_tokens: 600 },
            { type: 'message', input_tokens: 30, output_tokens: 20 },
          ],
        },
      });
    });

    const result = await invokeChiefProvider({
      ANTHROPIC_API_KEY: 'anthropic-key',
      CHIEF_ANTHROPIC_MODEL: 'claude-sonnet-5-5',
      CHIEF_ANTHROPIC_ADVISOR_ENABLED: 'true',
    }, {
      provider: 'anthropic',
      prompt: 'Implement the smallest safe repair.',
      useAdvisor: true,
    }, fetchMock);

    expect(result.optimization).toMatchObject({
      advisorRequested: true,
      advisorObserved: true,
      advisorCalls: 1,
      advisorInputTokens: 200,
      advisorOutputTokens: 600,
      fastRequested: false,
      speedObserved: 'unknown',
    });
  });

  it('enables advisor-side caching only for an explicit long-loop policy', async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const payload = JSON.parse(String(init.body));
      expect(payload.tools[0].caching).toEqual({ type: 'ephemeral', ttl: '1h' });
      return jsonResponse({
        id: 'msg_advisor_cache_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Claude result' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      });
    });

    await invokeChiefProvider({
      ANTHROPIC_API_KEY: 'anthropic-key',
      CHIEF_ANTHROPIC_MODEL: 'claude-sonnet-5-5',
      CHIEF_ANTHROPIC_ADVISOR_ENABLED: 'true',
      CHIEF_ANTHROPIC_ADVISOR_CACHE_ENABLED: 'true',
      CHIEF_ANTHROPIC_CACHE_TTL: '1h',
    }, {
      provider: 'anthropic',
      prompt: 'Continue the agent loop.',
      useAdvisor: true,
    }, fetchMock);
  });

  it('uses fast mode only for explicitly enabled supported Opus models and records observed speed', async () => {
    const fetchMock = vi.fn(async (_url, init) => {
      const payload = JSON.parse(String(init.body));
      expect(init.headers['anthropic-beta']).toContain('fast-mode-2026-02-01');
      expect(payload.speed).toBe('fast');
      return jsonResponse({
        id: 'msg_fast_1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Fast Claude result' }],
        usage: { input_tokens: 10, output_tokens: 5, speed: 'fast' },
      });
    });

    const result = await invokeChiefProvider({
      ANTHROPIC_API_KEY: 'anthropic-key',
      CHIEF_ANTHROPIC_MODEL: 'claude-opus-5-5',
      CHIEF_ANTHROPIC_FAST_MODE_ENABLED: 'true',
    }, {
      provider: 'anthropic',
      prompt: 'Return a latency-sensitive result.',
      useFast: true,
    }, fetchMock);

    expect(result.optimization).toMatchObject({
      fastRequested: true,
      speedObserved: 'fast',
    });
  });

  it('rejects fast mode on unsupported executor models before dispatch', async () => {
    const fetchMock = vi.fn();
    await expect(invokeChiefProvider({
      ANTHROPIC_API_KEY: 'anthropic-key',
      CHIEF_ANTHROPIC_MODEL: 'claude-sonnet-5-5',
      CHIEF_ANTHROPIC_FAST_MODE_ENABLED: 'true',
    }, {
      provider: 'anthropic',
      prompt: 'Do not dispatch.',
      useFast: true,
    }, fetchMock)).rejects.toThrow(/fast mode requires Claude Opus/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('creates Anthropic batches with shared 1h cache context and rejects fast mode in batch', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://api.anthropic.com/v1/messages/batches');
      const payload = JSON.parse(String(init.body));
      expect(payload.requests).toHaveLength(2);
      expect(payload.requests[0].custom_id).toBe('case_1');
      expect(payload.requests[0].params.system[0].cache_control).toEqual({ type: 'ephemeral', ttl: '1h' });
      return jsonResponse({
        id: 'msgbatch_01',
        type: 'message_batch',
        processing_status: 'in_progress',
        request_counts: { processing: 2, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
      });
    });

    const result = await createChiefAnthropicBatch({
      ANTHROPIC_API_KEY: 'anthropic-key',
      CHIEF_ANTHROPIC_MODEL: 'claude-sonnet-5-5',
      CHIEF_ANTHROPIC_BATCH_ENABLED: 'true',
    }, {
      requests: [
        { customId: 'case_1', prompt: 'Analyze case one.', stableContext: 'Shared stable context' },
        { customId: 'case_2', prompt: 'Analyze case two.', stableContext: 'Shared stable context' },
      ],
    }, fetchMock);

    expect(result).toMatchObject({
      mode: 'batch',
      batchId: 'msgbatch_01',
      status: 'in_progress',
      evidenceRef: 'provider:anthropic-batch:msgbatch_01',
    });

    await expect(createChiefAnthropicBatch({
      ANTHROPIC_API_KEY: 'anthropic-key',
      CHIEF_ANTHROPIC_BATCH_ENABLED: 'true',
    }, {
      requests: [{ customId: 'case_fast', prompt: 'Nope', useFast: true }],
    }, fetchMock)).rejects.toThrow('does not support fast mode');
  });

  it('parses bounded Anthropic batch JSONL results by custom_id', async () => {
    const lines = [
      JSON.stringify({ custom_id: 'case_2', result: { type: 'succeeded', message: { id: 'msg_2', content: [{ type: 'text', text: 'two' }] } } }),
      JSON.stringify({ custom_id: 'case_1', result: { type: 'errored', error: { type: 'invalid_request_error' } } }),
    ].join('\n');
    const fetchMock = vi.fn(async () => new Response(lines, {
      status: 200,
      headers: { 'content-type': 'application/jsonl' },
    }));

    const result = await getChiefAnthropicBatchResults({
      ANTHROPIC_API_KEY: 'anthropic-key',
    }, 'msgbatch_01', fetchMock);

    expect(result.results.map((entry) => entry.custom_id)).toEqual(['case_2', 'case_1']);
    expect(result.evidenceRef).toBe('provider:anthropic-batch:msgbatch_01');
  });

});
