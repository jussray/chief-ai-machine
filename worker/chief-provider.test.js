import { describe, it, expect, vi } from 'vitest';
import { handleChiefProviderRequest } from './chief-provider.js';
import worker from './index.js';

const env = {
  CHIEF_AI_OPERATOR_KEY: 'operator-fixture',
  OPENAI_API_KEY: 'provider-fixture',
  CHIEF_OPENAI_MODEL: 'fixture-model',
};

/**
 * @param {Record<string, unknown> | null} [body]
 * @param {string} [authorization]
 * @param {string} [method]
 */
function request(
  body = { prompt: 'Compare two public options.', sensitivity: 'public' },
  authorization = 'Bearer operator-fixture',
  method = 'POST',
) {
  return new Request('https://chief.example/api/chief/provider', {
    method,
    headers: {
      authorization,
      ...(method === 'POST' ? { 'content-type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

const completed = {
  id: 'resp_fixture',
  status: 'completed',
  output: [{
    type: 'message',
    role: 'assistant',
    content: [{ type: 'output_text', text: 'Unreviewed comparison.' }],
  }],
};

describe('bounded Chief provider HTTP membrane', () => {
  it('fails closed before inference when the operator is absent or wrong', async () => {
    const fetchImpl = vi.fn();
    expect((await handleChiefProviderRequest(request(), {}, fetchImpl)).status).toBe(503);
    expect((await handleChiefProviderRequest(request(undefined, 'Bearer wrong'), env, fetchImpl)).status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('reports configuration without invoking the provider', async () => {
    const fetchImpl = vi.fn();
    const response = await handleChiefProviderRequest(request(undefined, 'Bearer operator-fixture', 'GET'), env, fetchImpl);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      service: 'chief-ai',
      provider: 'openai',
      state: 'INTEGRATED',
      model: 'fixture-model',
      authority: 'none',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('requires an explicit provider key and model on the HTTP boundary', async () => {
    const fetchImpl = vi.fn();
    expect((await handleChiefProviderRequest(request(), { ...env, CHIEF_OPENAI_MODEL: '' }, fetchImpl)).status).toBe(503);
    expect((await handleChiefProviderRequest(request(), { ...env, OPENAI_API_KEY: '' }, fetchImpl)).status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    { prompt: 'Private material.', sensitivity: 'restricted' },
    { prompt: 'Missing sensitivity.' },
    { prompt: 'x'.repeat(8001), sensitivity: 'public' },
    { prompt: 'Public material.', sensitivity: 'public', tools: ['deploy'] },
    null,
  ])('rejects unsafe or unbounded input %#', async (body) => {
    const fetchImpl = vi.fn();
    expect((await handleChiefProviderRequest(request(body), env, fetchImpl)).status).toBe(400);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('enforces a request byte bound before provider use', async () => {
    const fetchImpl = vi.fn();
    expect((await handleChiefProviderRequest(
      request({ prompt: 'x'.repeat(17000), sensitivity: 'public' }),
      env,
      fetchImpl,
    )).status).toBe(413);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('uses the shared runtime once and returns a nonauthorizing draft receipt', async () => {
    const fetchImpl = vi.fn(/** @type {typeof fetch} */ (async (url, options) => {
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      expect(options?.redirect).toBe('error');
      expect(JSON.parse(String(options?.body))).toMatchObject({
        model: 'fixture-model',
        store: false,
        max_output_tokens: 2000,
      });
      return Response.json(completed);
    }));
    const response = await handleChiefProviderRequest(request(), env, fetchImpl);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({
      response_id: 'resp_fixture',
      evidence_ref: 'provider:openai:resp_fixture',
      state: 'draft',
      authority: 'none',
      text: 'Unreviewed comparison.',
    });
    expect(JSON.stringify(body)).not.toContain('provider-fixture');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each(['incomplete', 'failed', 'cancelled', 'queued', 'in_progress', undefined])(
    'rejects non-completed provider status %s without retries',
    async (status) => {
      const fetchImpl = vi.fn(async () => Response.json({ ...completed, status }));
      const response = await handleChiefProviderRequest(request(), env, fetchImpl);
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain('Unreviewed comparison.');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it('never forwards provider exception or error-body detail', async () => {
    for (const fetchImpl of [
      vi.fn(async () => new Response('provider-fixture', { status: 401 })),
      vi.fn(async () => { throw new Error('provider-fixture'); }),
    ]) {
      const response = await handleChiefProviderRequest(request(), env, fetchImpl);
      expect(response.status).toBe(502);
      expect(await response.text()).not.toContain('provider-fixture');
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    }
  });

  it('routes through the real Worker and keeps the provider private by default', async () => {
    const response = await worker.fetch(new Request('https://chief.example/api/chief/provider'), env);
    expect(response.status).toBe(401);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await response.text()).not.toContain('fixture-model');
  });
});


describe('Protect Me 2 public-draft pilot membrane', () => {
  const pilotEnv = {
    ...env,
    CHIEF_PROTECT2_PILOT_MODE: 'enforce-public-draft',
    CHIEF_PROTECT2_API_KEY: 'jp2_synthetic_fixture_00000001',
  };
  const normal = { prompt: 'Synthetic public comparison.', sensitivity: 'public' };

  it('does not change the provider route unless the server-owned pilot flag is set', async () => {
    const mock = vi.fn(async (url) => {
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      return Response.json(completed);
    });
    const response = await handleChiefProviderRequest(request(normal), env, mock);
    expect(response.status).toBe(200);
    expect(mock).toHaveBeenCalledTimes(1);
    expect(String(mock.mock.calls[0][0])).toBe('https://api.openai.com/v1/responses');
    expect((await response.json()).protection).toBeUndefined();
  });

  it('fails closed when pilot mode is configured but no Model Two identity exists', async () => {
    const mock = vi.fn();
    const response = await handleChiefProviderRequest(
      request(normal),
      { ...pilotEnv, CHIEF_PROTECT2_API_KEY: '' },
      mock,
    );
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'protect2_pilot_not_configured' });
    expect(mock).not.toHaveBeenCalled();
  });

  it('refuses unknown server-side modes without silent fallback', async () => {
    const mock = vi.fn();
    const response = await handleChiefProviderRequest(
      request(normal),
      { ...pilotEnv, CHIEF_PROTECT2_PILOT_MODE: 'unexpected' },
      mock,
    );
    expect(response.status).toBe(503);
    expect(mock).not.toHaveBeenCalled();
  });

  it('rejects internal prompts locally without ever calling Protect Me 2 or the provider', async () => {
    const mock = vi.fn();
    const response = await handleChiefProviderRequest(
      request({ prompt: 'Private internal material', sensitivity: 'internal' }),
      pilotEnv,
      mock,
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'protect2_pilot_public_only' });
    expect(mock).not.toHaveBeenCalled();
  });

  it('denies gateway-blocked calls without invoking an AI provider', async () => {
    const mock = vi.fn(async () => Response.json({
      decision: 'block', reasons: ['tool_not_allowed'], checkedAt: new Date().toISOString(),
    }));
    const response = await handleChiefProviderRequest(request(normal), pilotEnv, mock);
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'protect2_gateway_denied' });
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the gateway is unreachable or answers invalid/stale success', async () => {
    for (const reply of [
      async () => { throw new Error('synthetic-outage-secret'); },
      async () => Response.json({ decision: 'allow', reasons: [], checkedAt: '2020-01-01T00:00:00Z' }),
      async () => Response.json({ decision: 'allow', reasons: ['unexpected'], checkedAt: new Date().toISOString() }),
      async () => new Response('not JSON'),
    ]) {
      const mock = vi.fn(reply);
      const response = await handleChiefProviderRequest(request(normal), pilotEnv, mock);
      expect(response.status).toBe(503);
      expect(await response.text()).not.toContain('synthetic-outage-secret');
      expect(mock).toHaveBeenCalledTimes(1);
    }
  });

  it('cancels oversized streamed gateway replies before buffering the full body', async () => {
    let chunksRead = 0;
    let canceled = false;
    const stream = new globalThis.ReadableStream({
      pull(controller) {
        chunksRead += 1;
        controller.enqueue(new globalThis.TextEncoder().encode('x'.repeat(4096)));
      },
      cancel() { canceled = true; },
    });
    const mock = vi.fn(async () => new Response(stream, { status: 200 }));
    const response = await handleChiefProviderRequest(request(normal), pilotEnv, mock);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'protect2_gateway_invalid_response' });
    expect(canceled).toBe(true);
    expect(chunksRead).toBeLessThan(10);
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('forwards only a fixed action identifier and returns an evidence-scoped draft on allow', async () => {
    const urls = [];
    const mock = vi.fn(async (url, options) => {
      urls.push(String(url));
      if (String(url) === 'https://protect2.jussco.company/gateway/check') {
        expect(options.method).toBe('POST');
        expect(options.redirect).toBe('error');
        expect(options.cache).toBe('no-store');
        expect(options.headers.Authorization).toBe('Bearer ' + pilotEnv.CHIEF_PROTECT2_API_KEY);
        expect(JSON.parse(options.body)).toEqual({ tool: 'chief.draft.generate' });
        expect(options.body).not.toContain(normal.prompt);
        expect(options.body).not.toContain('provider-fixture');
        return Response.json({ decision: 'allow', reasons: [], checkedAt: new Date().toISOString() });
      }
      expect(String(url)).toBe('https://api.openai.com/v1/responses');
      return Response.json(completed);
    });
    const response = await handleChiefProviderRequest(request(normal), pilotEnv, mock);
    expect(response.status).toBe(200);
    expect(urls).toEqual([
      'https://protect2.jussco.company/gateway/check',
      'https://api.openai.com/v1/responses',
    ]);
    const body = await response.json();
    expect(body).toMatchObject({
      state: 'draft',
      authority: 'none',
      protection: {
        service: 'juss-protect-me-2',
        action: 'chief.draft.generate',
        decision: 'allow',
        authority: 'none',
      },
    });
    expect(JSON.stringify(body)).not.toContain(pilotEnv.CHIEF_PROTECT2_API_KEY);
  });

  it('unauthorized Chief callers cannot probe the pilot or its credentials', async () => {
    const mock = vi.fn();
    const response = await handleChiefProviderRequest(
      request(normal, 'Bearer incorrect'),
      pilotEnv,
      mock,
    );
    expect(response.status).toBe(401);
    expect(mock).not.toHaveBeenCalled();
  });
});
