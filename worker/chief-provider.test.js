import { describe, it, expect, vi } from 'vitest';
import { handleChiefProviderRequest } from './chief-provider.js';
import worker from './index.js';

const env = {
  CHIEF_AI_OPERATOR_KEY: 'operator-fixture',
  OPENAI_API_KEY: 'provider-fixture',
  CHIEF_OPENAI_MODEL: 'fixture-model',
};

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
    const fetchImpl = vi.fn(async () => Response.json(completed));
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
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options?.redirect).toBe('error');
    expect(JSON.parse(String(options?.body))).toMatchObject({
      model: 'fixture-model',
      store: false,
      max_output_tokens: 2000,
    });
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
