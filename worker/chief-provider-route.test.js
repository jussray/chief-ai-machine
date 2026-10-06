import { describe, expect, it, vi } from 'vitest';
import httpWorker from './http-worker.js';
import { handleChiefProviderRoute } from './chief-provider-route.js';

const route = 'https://chief.example/api/chief/provider';
const post = (body) => new Request(route, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
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
      OPENAI_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error.code).toBe('provider_execution_failed');
    expect(body.error.message).toBe('openai provider returned a non-completed response');
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
      OPENAI_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_provider_request');
    expect(body.governance.externalProviderCall).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('routes Anthropic batch create without widening authority', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({
      id: 'msgbatch_route_1',
      type: 'message_batch',
      processing_status: 'in_progress',
      request_counts: { processing: 1, succeeded: 0, errored: 0, canceled: 0, expired: 0 },
    }));
    const response = await handleChiefProviderRoute(post({
      mode: 'batch',
      operation: 'create',
      requests: [{ customId: 'route_1', prompt: 'Analyze this.' }],
    }), {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      CHIEF_ANTHROPIC_BATCH_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toMatchObject({
      provider: 'anthropic',
      mode: 'batch',
      batchId: 'msgbatch_route_1',
      authority: 'none',
    });
    expect(body.governance).toMatchObject({
      authority: 'none',
      executionAuthorized: false,
      founderApprovalCarriedForward: false,
      externalProviderCall: true,
    });
  });

  it('rejects unsupported batch operations before provider dispatch', async () => {
    const fetchMock = vi.fn();
    const response = await handleChiefProviderRoute(post({
      mode: 'batch',
      operation: 'teleport',
    }), {
      CHIEF_PROVIDER_RUNTIME_ENABLED: 'true',
      ANTHROPIC_API_KEY: 'test-key',
    }, fetchMock);
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

});
