import { expect, test } from '@playwright/test';

const operator = 'Bearer synthetic-chief-operator-key';

test.beforeEach(async ({ request }) => {
  await request.post('/__fixture/reset');
});

test('Worker serves exact candidate identity and Protect Me 2-gated prompt drafts', async ({ request }) => {
  const version = await request.get('/version');
  expect(version.status()).toBe(200);
  await expect(version.json()).resolves.toMatchObject({
    ok: true,
    sha: process.env.EXPECTED_HEAD_SHA,
    branch: process.env.EXPECTED_HEAD_BRANCH,
    version_id: 'synthetic-provider-version',
  });

  const prompt = 'Remix this synthetic public product brief into three concise model-ready prompt variants.';
  const allowed = await request.post('/api/chief/provider', {
    headers: { authorization: operator, 'content-type': 'application/json' },
    data: { prompt, sensitivity: 'public' },
  });
  expect(allowed.status()).toBe(200);
  const draft = await allowed.json();
  expect(draft).toMatchObject({
    service: 'chief-ai',
    provider: 'openai',
    text: 'Synthetic remixed draft.',
    state: 'draft',
    authority: 'none',
    protection: {
      service: 'juss-protect-me-2',
      action: 'chief.draft.generate',
      decision: 'allow',
      authority: 'none',
    },
  });
  expect(draft.response_id).toBe('resp_chief_fixture');

  const allowedObservation = await (await request.get('/__fixture/observations')).json();
  expect(allowedObservation).toMatchObject({
    protect2Calls: 1,
    providerCalls: 1,
    protect2PayloadOnlyTool: true,
    providerReceivedPrompt: true,
  });

  await request.post('/__fixture/reset');
  const denied = await request.post('/api/chief/provider', {
    headers: { authorization: operator, 'content-type': 'application/json' },
    data: { prompt: 'DENY_FIXTURE public draft must be blocked.', sensitivity: 'public' },
  });
  expect(denied.status()).toBe(403);
  await expect(denied.json()).resolves.toEqual({ error: 'protect2_gateway_denied' });
  const deniedObservation = await (await request.get('/__fixture/observations')).json();
  expect(deniedObservation).toMatchObject({
    protect2Calls: 1,
    providerCalls: 0,
    protect2PayloadOnlyTool: true,
    providerReceivedPrompt: false,
  });

  await request.post('/__fixture/reset');
  const internal = await request.post('/api/chief/provider', {
    headers: { authorization: operator, 'content-type': 'application/json' },
    data: { prompt: 'Internal draft must not reach external services.', sensitivity: 'internal' },
  });
  expect(internal.status()).toBe(403);
  await expect(internal.json()).resolves.toEqual({ error: 'protect2_pilot_public_only' });
  const internalObservation = await (await request.get('/__fixture/observations')).json();
  expect(internalObservation).toMatchObject({
    protect2Calls: 0,
    providerCalls: 0,
    protect2PayloadOnlyTool: true,
    providerReceivedPrompt: false,
  });
});

test('Worker rejects unauthorized prompt generation before contacting either provider', async ({ request }) => {
  const response = await request.post('/api/chief/provider', {
    headers: { authorization: 'Bearer incorrect', 'content-type': 'application/json' },
    data: { prompt: 'Synthetic prompt', sensitivity: 'public' },
  });
  expect(response.status()).toBe(401);
  const observations = await (await request.get('/__fixture/observations')).json();
  expect(observations).toMatchObject({ protect2Calls: 0, providerCalls: 0 });
});
