import { afterEach, describe, expect, it, vi } from 'vitest';
import httpWorker from './http-worker.js';

const RELEASE_SHA = '1234567890abcdef1234567890abcdef12345678';

function env(overrides = {}) {
  return {
    RELEASE_SHA,
    OPENAI_API_KEY: 'test-openai-key',
    CHIEF_RUNTIME_PROOF_TOKEN: 'proof-token',
    ASSETS: { fetch: vi.fn() },
    ...overrides,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Chief live runtime proof', () => {
  it('reports release identity and provider readiness without secrets', async () => {
    const response = await httpWorker.fetch(
      new Request('https://chief.example/api/chief/runtime-identity'),
      env(),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      ok: true,
      service: 'chief-ai',
      release_sha: RELEASE_SHA,
      providers: {
        openai: { state: 'INTEGRATED', model: 'gpt-5.6-sol' },
        anthropic: { state: 'ABSENT', model: 'claude-sonnet-5' },
        muse: { state: 'ABSENT', model: 'muse-spark-1.3' },
      },
    });
    expect(JSON.stringify(body)).not.toContain('test-openai-key');
  });

  it('rejects runtime inference proof without the proof token', async () => {
    const response = await httpWorker.fetch(
      new Request('https://chief.example/api/chief/runtime-proof', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'openai' }),
      }),
      env(),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns provider provenance while withholding model output', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      id: 'resp_runtime_proof_1',
      status: 'completed',
      output_text: 'CHIEF_RUNTIME_PROOF_OK',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })));

    const response = await httpWorker.fetch(
      new Request('https://chief.example/api/chief/runtime-proof', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer proof-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider: 'openai' }),
      }),
      env(),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      service: 'chief-ai',
      release_sha: RELEASE_SHA,
      provider: 'openai',
      model: 'gpt-5.6-sol',
      response_id: 'resp_runtime_proof_1',
      evidence_ref: 'provider:openai:resp_runtime_proof_1',
      provider_state: 'VERIFIED',
    });
    expect(JSON.stringify(body)).not.toContain('CHIEF_RUNTIME_PROOF_OK');
  });
});
