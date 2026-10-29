import { describe, expect, it, vi } from 'vitest';
import {
  chiefProviderStates,
  invokeChiefProvider,
} from './provider-runtime.js';

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

const MUSE_ENV = { MODEL_API_KEY: 'muse-secret-value', CHIEF_MUSE_MODEL: 'muse-spark-1.3' };

describe('Chief provider runtime — Muse hardening', () => {
  it('does not advertise Muse without a key', () => {
    const states = chiefProviderStates({ CHIEF_MUSE_MODEL: 'muse-spark-1.3' });
    expect(states.muse.state).toBe('ABSENT');
    expect(states.muse.advertised).toBe(false);
    expect(states.muse.model).toBe(null);
  });

  it('reports PRESENT (never INTEGRATED) when the key exists but the model var is unset', () => {
    const states = chiefProviderStates({ MODEL_API_KEY: 'muse-secret-value' });
    expect(states.muse.state).toBe('PRESENT');
    expect(states.muse.advertised).toBe(false);
    expect(JSON.stringify(states)).not.toContain('muse-secret-value');
  });

  it('does not advertise Muse with an unsafe model', () => {
    for (const model of ['muse-spark-2.0', 'muse-spark-1.4', 'gpt-5.6-sol', 'muse-spark-1.3 ']) {
      const states = chiefProviderStates({ MODEL_API_KEY: 'muse-secret-value', CHIEF_MUSE_MODEL: model });
      expect(states.muse.advertised).toBe(model === 'muse-spark-1.3 ' ? true : false);
      if (model !== 'muse-spark-1.3 ') expect(states.muse.state).toBe('PRESENT');
    }
  });

  it('advertises Muse as INTEGRATED only with key + allow-listed model, and never VERIFIED', () => {
    const states = chiefProviderStates(MUSE_ENV);
    expect(states.muse.state).toBe('INTEGRATED');
    expect(states.muse.advertised).toBe(true);
    expect(states.muse.model).toBe('muse-spark-1.3');
    expect(JSON.stringify(states)).not.toContain('VERIFIED');
    expect(JSON.stringify(states)).not.toContain('muse-secret-value');
  });

  it('rejects Muse invocation pre-network when the model var is unset or unsafe', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'x', status: 'completed', output_text: 'x' }));
    await expect(invokeChiefProvider({ MODEL_API_KEY: 'k' }, {
      provider: 'muse', prompt: 'hello',
    }, fetchMock)).rejects.toThrow(/not configured/);
    await expect(invokeChiefProvider({ MODEL_API_KEY: 'k', CHIEF_MUSE_MODEL: 'muse-spark-9.9' }, {
      provider: 'muse', prompt: 'hello',
    }, fetchMock)).rejects.toThrow(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('makes a bounded Muse call and returns text with a provider:meta evidence ref', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://api.meta.ai/v1/responses');
      expect(init.headers.authorization).toBe('Bearer muse-secret-value');
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ model: 'muse-spark-1.3', store: false, max_output_tokens: 2000 });
      return jsonResponse({ id: 'resp_muse_1', status: 'completed', output_text: 'Muse result' });
    });
    const result = await invokeChiefProvider(MUSE_ENV, {
      provider: 'muse',
      prompt: 'Challenge provider drift.',
    }, fetchMock);
    expect(result).toMatchObject({
      provider: 'muse',
      model: 'muse-spark-1.3',
      evidenceRef: 'provider:meta:resp_muse_1',
      state: 'INTEGRATED',
      authority: 'none',
      text: 'Muse result',
    });
  });

  it('never serializes the Muse key into the request body', async () => {
    const fetchMock = vi.fn(async (url, init) => {
      expect(String(init.body)).not.toContain('muse-secret-value');
      return jsonResponse({ id: 'resp_muse_2', status: 'completed', output_text: 'ok' });
    });
    await invokeChiefProvider(MUSE_ENV, { provider: 'muse', prompt: 'ping' }, fetchMock);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects restricted context pre-network', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'x', status: 'completed', output_text: 'x' }));
    await expect(invokeChiefProvider(MUSE_ENV, {
      provider: 'muse',
      prompt: 'private',
      sensitivity: 'restricted',
    }, fetchMock)).rejects.toThrow(/restricted context/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on a non-completed Muse response', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'resp_muse_3', status: 'failed', output_text: 'partial' }));
    await expect(invokeChiefProvider(MUSE_ENV, {
      provider: 'muse', prompt: 'ping',
    }, fetchMock)).rejects.toThrow(/non-completed/);
  });

  it('fails closed with a sanitized error on HTTP failure (no provider body promoted)', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ error: 'muse-secret-value leaked body' }, 500));
    await expect(invokeChiefProvider(MUSE_ENV, {
      provider: 'muse', prompt: 'ping',
    }, fetchMock)).rejects.toThrow(/failed with HTTP 500/);
  });

  it('keeps the paused Muse review capability blocked', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ id: 'x', status: 'completed', output_text: 'x' }));
    await expect(invokeChiefProvider(MUSE_ENV, {
      provider: 'muse', prompt: 'review this', capability: 'review',
    }, fetchMock)).rejects.toThrow(/paused/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still invokes OpenAI and Anthropic from the ported snapshot runtime', async () => {
    const openaiFetch = vi.fn(async () => jsonResponse({ id: 'resp_openai_1', output_text: 'OpenAI result' }));
    const openai = await invokeChiefProvider({ OPENAI_API_KEY: 'openai-key' }, {
      provider: 'openai', prompt: 'Challenge this architecture.',
    }, openaiFetch);
    expect(openai.evidenceRef).toBe('provider:openai:resp_openai_1');
    expect(openai.authority).toBe('none');

    const anthropicFetch = vi.fn(async (url, init) => {
      expect(String(init.body)).not.toContain('anthropic-key');
      return jsonResponse({ id: 'msg_claude_1', content: [{ type: 'text', text: 'Claude result' }] });
    });
    const anthropic = await invokeChiefProvider({ ANTHROPIC_API_KEY: 'anthropic-key' }, {
      provider: 'anthropic', prompt: 'Find the weakest assumption.',
    }, anthropicFetch);
    expect(anthropic.evidenceRef).toBe('provider:anthropic:msg_claude_1');
  });
});
