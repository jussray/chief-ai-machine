import { describe, expect, it } from 'vitest';
import httpWorker from './http-worker.js';
import { handleChiefControlRoomRecommendation } from './chief-control-room-recommendation.js';

function input(overrides = {}) {
  return {
    projectName: "Se'kret Bip",
    projectType: 'ai-agent',
    mission: 'launch',
    currentState: 'live',
    repoIdentifier: 'jussray/Sekret-Bip',
    stack: 'Cloudflare + Supabase',
    ...overrides,
  };
}

function request(body, method = 'POST', path = '/api/chief/control-room-recommendation') {
  return new Request(`https://chief.example${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}

describe('Chief Control Room recommendation API', () => {
  it('routes onboarding through Chief and returns recommendation-only authority', async () => {
    const response = await httpWorker.fetch(request(input()), {
      ASSETS: { fetch: () => new Response('not used', { status: 404 }) },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.recommendation).toMatchObject({
      contract: 'chief-ai/control-room-recommendation@v1',
      selectedBy: 'chief-ai-machine',
      title: 'Chief recommends a AI / Agent System Control Room focused on Launch.',
      founderDecision: {
        required: true,
        explicitDecisionOnly: true,
        accepted: false,
        createControlRoomAuthorized: false,
      },
      fcrHandoff: {
        stateAuthority: 'founder-control-room',
        evidenceAuthority: 'founder-control-room',
        executionAuthority: 'unresolved-by-chief-ai',
      },
    });
    expect(body.data.recommendation.recommendationHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.data.governanceBoundary).toMatchObject({
      proposalOnly: true,
      founderApprovalRequired: true,
      executionAuthorized: false,
      createControlRoomAuthorized: false,
      projectStateMutationAuthorized: false,
      providerMutationAuthorized: false,
      mergeAuthorized: false,
      deploymentAuthorized: false,
      credentialAuthority: 'none',
      stateAuthority: 'founder-control-room',
      evidenceAuthority: 'founder-control-room',
      recommendationMutationInvalidatesAcceptance: true,
    });
    expect(JSON.stringify(body)).not.toMatch(/api[_-]?key|private[_-]?key|secretRef|password/i);
  });

  it('rejects credential-bearing onboarding payloads before recommendation logic', async () => {
    const response = await handleChiefControlRoomRecommendation(request({
      ...input(),
      connection: { token: 'never-accept-this' },
    }));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('credentials_not_accepted');
    expect(body.error.message).toContain('connection.token');
  });

  it('fails closed on unsupported FCR onboarding classifications', async () => {
    const response = await handleChiefControlRoomRecommendation(request(input({ mission: 'autopilot' })));

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_control_room_recommendation_request');
    expect(body.error.message).toContain('Unsupported Control Room mission');
  });

  it('requires POST and refuses to treat route discovery as authority', async () => {
    const response = await handleChiefControlRoomRecommendation(request(null, 'GET'));

    expect(response.status).toBe(405);
    const body = await response.json();
    expect(body.error.code).toBe('method_not_allowed');
  });

  it('keeps unrelated API routes outside this handler', async () => {
    const response = await handleChiefControlRoomRecommendation(request(input(), 'POST', '/api/chief/other'));

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('not_found');
  });
});
