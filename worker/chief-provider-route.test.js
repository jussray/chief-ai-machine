import { describe, expect, it, vi } from 'vitest';
import httpWorker from './http-worker.js';
import { handleChiefProviderRoute } from './chief-provider-route.js';

const route = 'https://chief.example/api/chief/provider';
const TEST_TOKEN = 'provider-runtime-test-authorization-token-0123456789abcdef';
const post = (body, token = TEST_TOKEN) => new Request(route, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});
const jsonResponse = (body) => new Response(JSON.stringify(body), {
  status: 200,
  headers: { 'content-type': 'application/json' },
});

describe('Chief provider HTTP route', () => {
  it('is mounted in the runtime-neutral HTTP worker and fails closed by default', async () => {
    const response = await httpWorker.fetch(post({
      provider: 'openai',
      prompt: 'Challenge this architecture.',
    }), {});
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe('provider_runtime_disabled');
    expect(body.governance).toMatchObject({
      authority: 'none',
      executionAuthorized: false,
      founderApprovalCarriedForward: false,
      externalProviderCall: false,
    });
  });

  it('rejects missing and incorrect provider runtime authorization before any external call', async () => {
    const fetchMock = vi.fn();
    const env = {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_PROVIDER_RUNTIME_TOKEN: TEST_TOKEN,
      OPENAI_API_KEY: 'test-only-provider-key',
    };
    const body = { provider: 'openai', prompt: 'Do not dispatch.' };
    const missing = await handleChiefProviderRoute(post(body, null), env, fetchMock);
    const wrong = await handleChiefProviderRoute(post(body, 'incorrect-provider-runtime-token-0123456789'), env, fetchMock);
    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect((await missing.json()).error.code).toBe('unauthorized');
    expect((await wrong.json()).error.code).toBe('unauthorized');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses an enabled provider runtime without its own strong server-held token', async () => {
    const fetchMock = vi.fn();
    const request = post({ provider: 'openai', prompt: 'Not authorized.' });
    const response = await handleChiefProviderRoute(request, {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_PROVIDER_RUNTIME_TOKEN: 'short',
      OPENAI_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not reveal raw provider failures in public route responses', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('provider-token-LEAKMARKER'); });
    const response = await handleChiefProviderRoute(post({
      provider: 'openai', prompt: 'Diagnose service connectivity.',
    }), {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_PROVIDER_RUNTIME_TOKEN: TEST_TOKEN,
      OPENAI_API_KEY: 'test-only-key',
    }, fetchMock);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain('LEAKMARKER');
    expect(body.error.code).toBe('invalid_provider_request');
  });

  it('returns completed provider evidence without widening authority', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      id: 'resp_route_complete',
      status: 'completed',
      output_text: 'bounded answer',
    }));
    const response = await handleChiefProviderRoute(post({
      provider: 'openai',
      prompt: 'Challenge this architecture.',
    }), {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_PROVIDER_RUNTIME_TOKEN: TEST_TOKEN,
      OPENAI_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      provider: 'openai',
      responseId: 'resp_route_complete',
      evidenceRef: 'provider:openai:resp_route_complete',
      authority: 'none',
      text: 'bounded answer',
    });
    expect(body.governance).toMatchObject({
      authority: 'none',
      executionAuthorized: false,
      founderApprovalCarriedForward: false,
      externalProviderCall: true,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects incomplete provider output, records the external call, and does not retry', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      id: 'resp_route_partial',
      status: 'incomplete',
      output_text: 'unfinished answer',
    }));
    const response = await handleChiefProviderRoute(post({
      provider: 'openai',
      prompt: 'Challenge this architecture.',
    }), {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_PROVIDER_RUNTIME_TOKEN: TEST_TOKEN,
      OPENAI_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe('provider_execution_failed');
    expect(body.error.message).toBe('Provider execution failed.');
    expect(body.governance.externalProviderCall).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects restricted input before any provider call', async () => {
    const fetchMock = vi.fn();
    const response = await handleChiefProviderRoute(post({
      provider: 'openai',
      prompt: 'private context',
      sensitivity: 'restricted',
    }), {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_PROVIDER_RUNTIME_TOKEN: TEST_TOKEN,
      OPENAI_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_provider_request');
    expect(body.governance.externalProviderCall).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not dispatch batch jobs after the current-main batch runtime was retired', async () => {
    const fetchMock = vi.fn();
    const response = await handleChiefProviderRoute(post({
      mode: 'batch',
      operation: 'create',
      requests: [{ customId: 'route_1', prompt: 'Analyze this.' }],
    }), {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_PROVIDER_RUNTIME_TOKEN: TEST_TOKEN,
      CHIEF_ANTHROPIC_BATCH_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error.code).toBe('batch_runtime_unavailable');
    expect(body.governance.externalProviderCall).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects unsupported batch operations before provider dispatch', async () => {
    const fetchMock = vi.fn();
    const response = await handleChiefProviderRoute(post({
      mode: 'batch',
      operation: 'teleport',
    }), {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_PROVIDER_RUNTIME_TOKEN: TEST_TOKEN,
      ANTHROPIC_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('batch_runtime_unavailable');
    expect(fetchMock).not.toHaveBeenCalled();
  });

});
