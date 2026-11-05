import { describe, expect, it, vi } from 'vitest';
import { chiefProviderStates, invokeChiefProvider } from './provider-runtime.js';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const MUSE_ENV = { MODEL_API_KEY: 'muse-secret-value', CHIEF_MUSE_MODEL: 'muse-spark-1.3' };

describe('Chief provider runtime', () => {
  it('does not expose secret values and only advertises configured providers', () => {
    const states = chiefProviderStates({ OPENAI_API_KEY: 'openai-secret-value', ANTHROPIC_API_KEY: 'anthropic-secret-value', MODEL_API_KEY: 'muse-secret-value' });
    expect(states.openai.state).toBe('INTEGRATED');
    expect(states.anthropic.state).toBe('INTEGRATED');
    expect(states.muse).toMatchObject({ state: 'PRESENT', advertised: false, model: null });
    expect(JSON.stringify(states)).not.toContain('secret-value');
  });

  it('advertises Muse only with a key and an allow-listed model', () => {
    expect(chiefProviderStates({ CHIEF_MUSE_MODEL: 'muse-spark-1.3' }).muse).toMatchObject({ state: 'ABSENT', advertised: false });
    expect(chiefProviderStates(MUSE_ENV).muse).toMatchObject({ state: 'INTEGRATED', advertised: true, model: 'muse-spark-1.3' });
    expect(chiefProviderStates({ ...MUSE_ENV, CHIEF_MUSE_MODEL: 'muse-spark-2.0' }).muse).toMatchObject({ state: 'PRESENT', advertised: false, model: null });
  });

  it('invokes completed OpenAI responses without serializing its key', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      expect(init.headers.authorization).toBe('Bearer openai-key');
      expect(String(init.body)).not.toContain('openai-key');
      return jsonResponse({ id: 'resp_openai_1', status: 'completed', output_text: 'OpenAI result' });
    });
    const result = await invokeChiefProvider({ OPENAI_API_KEY: 'openai-key' }, { provider: 'openai', prompt: 'Challenge this architecture.' }, fetchMock);
    expect(result).toMatchObject({ provider: 'openai', model: 'gpt-5.6-sol', evidenceRef: 'provider:openai:resp_openai_1', authority: 'none', text: 'OpenAI result' });
  });

  it('invokes Anthropic without serializing its key', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://api.anthropic.com/v1/messages');
      expect(init.headers['x-api-key']).toBe('anthropic-key');
      expect(String(init.body)).not.toContain('anthropic-key');
      return jsonResponse({ id: 'msg_claude_1', content: [{ type: 'text', text: 'Claude result' }] });
    });
    const result = await invokeChiefProvider({ ANTHROPIC_API_KEY: 'anthropic-key' }, { provider: 'anthropic', prompt: 'Find the weakest assumption.' }, fetchMock);
    expect(result.evidenceRef).toBe('provider:anthropic:msg_claude_1');
  });

  it('makes a bounded Muse call only after safe configuration', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://api.meta.ai/v1/responses');
      expect(init.headers.authorization).toBe('Bearer muse-secret-value');
      expect(String(init.body)).not.toContain('muse-secret-value');
      return jsonResponse({ id: 'resp_muse_1', status: 'completed', output_text: 'Muse result' });
    });
    const result = await invokeChiefProvider(MUSE_ENV, { provider: 'muse', prompt: 'Challenge provider drift.' }, fetchMock);
    expect(result.evidenceRef).toBe('provider:meta:resp_muse_1');
  });

  it('rejects restricted or paused Muse work before network activity', async () => {
    const fetchMock = vi.fn();
    await expect(invokeChiefProvider(MUSE_ENV, { provider: 'muse', prompt: 'private', sensitivity: 'restricted' }, fetchMock)).rejects.toThrow(/restricted context/);
    await expect(invokeChiefProvider(MUSE_ENV, { provider: 'muse', prompt: 'review this', capability: 'review' }, fetchMock)).rejects.toThrow(/paused/);
    await expect(invokeChiefProvider({ MODEL_API_KEY: 'key' }, { provider: 'muse', prompt: 'hello' }, fetchMock)).rejects.toThrow(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['incomplete', 'failed', 'cancelled', 'queued', 'in_progress', undefined])('rejects non-completed OpenAI status %s', async (status) => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'resp_partial', status, output_text: 'unfinished' }));
    await expect(invokeChiefProvider({ OPENAI_API_KEY: 'openai-key' }, { provider: 'openai', prompt: 'Challenge this architecture.' }, fetchMock)).rejects.toThrow(/non-completed/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('fails closed on non-completed Muse and sanitized HTTP failures', async () => {
    await expect(invokeChiefProvider(MUSE_ENV, { provider: 'muse', prompt: 'ping' }, vi.fn(async () => jsonResponse({ id: 'resp_muse_3', status: 'failed', output_text: 'partial' })))).rejects.toThrow(/non-completed/);
    await expect(invokeChiefProvider(MUSE_ENV, { provider: 'muse', prompt: 'ping' }, vi.fn(async () => jsonResponse({ error: 'muse-secret-value' }, 500)))).rejects.toThrow(/failed with HTTP 500/);
  });
});
