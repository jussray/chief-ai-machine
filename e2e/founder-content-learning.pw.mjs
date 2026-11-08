import { createHash, createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

const baseURL = process.env.FOUNDER_CONTENT_LEARNING_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;
const secret = process.env.FCR_LEARNING_TEST_SECRET;
const keyId = process.env.FCR_LEARNING_TEST_KEY_ID;

if (!baseURL) throw new Error('FOUNDER_CONTENT_LEARNING_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');
if (!secret) throw new Error('FCR_LEARNING_TEST_SECRET is required');
if (!keyId) throw new Error('FCR_LEARNING_TEST_KEY_ID is required');

const ROUTE = '/api/chief/founder-content-learning';
const TRANSPORT_CONTRACT = 'juss-v10/fcr-founder-content-learning-http@v1';

function sha256Hex(value) {
  return createHash('sha256').update(value).digest('hex');
}

function observation() {
  const identity = {
    version: 1,
    content_id: '82a030bd-cd2c-4d72-96c9-b38746bc1380',
    authorization_hash: 'a'.repeat(64),
    public_payload_hash: 'b'.repeat(64),
    platform: 'linkedin',
    provider: 'buffer',
    provider_state: 'published',
    provider_receipt_id: 'playwright-runtime-receipt',
    observed_at: new Date(Date.now() - 60_000).toISOString(),
    metrics: {
      impressions: 1200,
      reactions: 42,
      comments: 9,
      profile_views: 21,
      attributed_visits: 17,
      qualified_conversations: 3,
      attributed_contacts: 2,
      attributed_deals: null,
    },
    metric_states: {
      impressions: 'observed',
      reactions: 'observed',
      comments: 'observed',
      profile_views: 'observed',
      attributed_visits: 'observed',
      qualified_conversations: 'observed',
      attributed_contacts: 'observed',
      attributed_deals: 'UNKNOWN',
    },
  };

  return {
    kind: 'fcr/founder-content-outcome-observation',
    ...identity,
    observation_hash: sha256Hex(JSON.stringify(identity)),
    authority: {
      observation_only: true,
      learning_authority: 'advisory_only',
      can_authorize_publish: false,
      can_change_content: false,
      can_increase_authority: false,
      missing_metrics_are_unknown: true,
    },
    privacy: {
      raw_post_text_stored: false,
      private_messages_stored: false,
      raw_comments_stored: false,
      provider_payload_stored: false,
      customer_private_data_stored: false,
    },
  };
}

function signedHeaders(rawBody, issuedAt = new Date().toISOString()) {
  const bodyHash = sha256Hex(rawBody);
  const signature = createHmac('sha256', secret)
    .update([TRANSPORT_CONTRACT, keyId, issuedAt, bodyHash].join('\n'))
    .digest('hex');

  return {
    'Content-Type': 'application/json; charset=utf-8',
    'X-FCR-Learning-Key-Id': keyId,
    'X-FCR-Learning-Issued-At': issuedAt,
    'X-FCR-Learning-Signature': signature,
  };
}

async function postSigned(request, body, issuedAt) {
  const rawBody = JSON.stringify(body);
  return request.post(`${baseURL}${ROUTE}`, {
    headers: signedHeaders(rawBody, issuedAt),
    data: rawBody,
  });
}

test.describe('authenticated FCR learning exact-head runtime', () => {
  test('serves the exact candidate head from local workerd', async ({ request }) => {
    const response = await request.get(`${baseURL}/version`);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sha: expectedHead });
  });

  test('accepts authenticated FCR evidence without widening authority', async ({ request }) => {
    const input = observation();
    const response = await postSigned(request, input);

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.advisorySignal.source_trust).toBe('submitted-unverified');
    expect(body.data.authenticatedSource).toMatchObject({
      transport_contract: TRANSPORT_CONTRACT,
      source_system: 'founder-control-room',
      source_trust: 'fcr-hmac-authenticated',
      source_authentication: 'hmac-sha256',
      source_authentication_verified: true,
      source_key_id: keyId,
      source_observation_hash: input.observation_hash,
      dedupe_key: input.observation_hash,
    });
    expect(body.data.authority).toEqual({
      evidence_only: true,
      learning_authority: 'advisory_only',
      execution_authorized: false,
      publish_authorized: false,
      content_mutation_authorized: false,
      may_increase_authority: false,
      authenticated_source_may_bypass_founder_approval: false,
    });
  });

  test('rejects tampering after the exact bytes were signed', async ({ request }) => {
    const input = observation();
    const rawBody = JSON.stringify(input);
    const headers = signedHeaders(rawBody);
    const tamperedBody = JSON.stringify({ ...input, provider_receipt_id: 'tampered-after-signing' });

    const response = await request.post(`${baseURL}${ROUTE}`, {
      headers,
      data: tamperedBody,
    });

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'fcr_learning_authentication_failed' },
    });
  });

  test('rejects authenticated evidence that tries to authorize publication', async ({ request }) => {
    const input = observation();
    input.authority.can_authorize_publish = true;
    const response = await postSigned(request, input);

    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_founder_content_observation');
    expect(body.error.message).toContain('can_authorize_publish must be false');
  });
});
