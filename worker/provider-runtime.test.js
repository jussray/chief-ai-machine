import { describe, expect, it, vi } from 'vitest';
import {
  chiefProviderStates,
  invokeChiefProvider,
} from './provider-runtime.js';

const jsonResponse = (body) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

describe('Chief provider runtime', () => {
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
      return jsonResponse({ id: 'resp_openai_1', output_text: 'OpenAI result' });
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
});
