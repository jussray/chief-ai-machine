import { describe, expect, it } from 'vitest';
import {
  FCR_LEARNING_ROUTE,
  FCR_LEARNING_TRANSPORT_CONTRACT,
  handleFounderContentLearning,
} from './founder-content-learning-route.js';

const encoder = new TextEncoder();
const SECRET = 'fixture-fcr-learning-secret';
const KEY_ID = 'founder-content-learning-v1';
const NOW_MS = Date.parse('2026-08-19T22:00:30.000Z');

function bytesToHex(value) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(value) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToHex(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
}

async function observation() {
  const identity = {
    version: 1,
    content_id: '82a030bd-cd2c-4d72-96c9-b38746bc1380',
    authorization_hash: 'a'.repeat(64),
    public_payload_hash: 'b'.repeat(64),
    platform: 'linkedin',
    provider: 'buffer',
    provider_state: 'published',
    provider_receipt_id: 'buffer-receipt-123',
    observed_at: '2026-08-19T21:00:00.000Z',
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
    observation_hash: await sha256Hex(JSON.stringify(identity)),
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

async function signedRequest(body, issuedAt = '2026-08-19T22:00:00.000Z', overrides = {}) {
  const rawBody = typeof body === 'string' ? body : JSON.stringify(body);
  const bodyHash = await sha256Hex(rawBody);
  const keyId = overrides.keyId ?? KEY_ID;
  const secret = overrides.secret ?? SECRET;
  const signature = await hmacHex(
    secret,
    [FCR_LEARNING_TRANSPORT_CONTRACT, keyId, issuedAt, bodyHash].join('\n'),
  );

  return new Request(`https://chief-ai.internal${FCR_LEARNING_ROUTE}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-FCR-Learning-Key-Id': keyId,
      'X-FCR-Learning-Issued-At': issuedAt,
      'X-FCR-Learning-Signature': signature,
    },
    body: rawBody,
  });
}

const env = {
  FCR_LEARNING_HMAC_SECRET: SECRET,
  FCR_LEARNING_HMAC_KEY_ID: KEY_ID,
};

describe('authenticated FCR founder-content learning route', () => {
  it('authenticates FCR source bytes without widening learning authority', async () => {
    const input = await observation();
    const response = await handleFounderContentLearning(await signedRequest(input), env, NOW_MS);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.error).toBeNull();
    expect(body.data.advisorySignal.source_trust).toBe('submitted-unverified');
    expect(body.data.advisorySignal.source_authentication_verified).toBe(false);
    expect(body.data.authenticatedSource).toMatchObject({
      transport_contract: 'juss-v10/fcr-founder-content-learning-http@v1',
      source_system: 'founder-control-room',
      source_trust: 'fcr-hmac-authenticated',
      source_authentication: 'hmac-sha256',
      source_authentication_verified: true,
      source_key_id: KEY_ID,
      source_observation_hash: input.observation_hash,
      dedupe_key: input.observation_hash,
    });
    expect(body.data.authenticatedSource.authenticated_source_hash).toMatch(/^[0-9a-f]{64}$/);
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

  it('rejects a body changed after FCR signed it', async () => {
    const input = await observation();
    const request = await signedRequest(input);
    const tampered = JSON.stringify({ ...input, provider_receipt_id: 'tampered-receipt' });
    const response = await handleFounderContentLearning(new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: tampered,
    }), env, NOW_MS);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'fcr_learning_authentication_failed' },
    });
  });

  it('rejects stale signed evidence instead of treating an old signature as current provenance', async () => {
    const input = await observation();
    const request = await signedRequest(input, '2026-08-19T21:50:00.000Z');
    const response = await handleFounderContentLearning(request, env, NOW_MS);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'fcr_learning_authentication_expired' },
    });
  });

  it('rejects a valid HMAC under an unconfigured key identity', async () => {
    const input = await observation();
    const request = await signedRequest(input, '2026-08-19T22:00:00.000Z', {
      keyId: 'attacker-controlled-key',
    });
    const response = await handleFounderContentLearning(request, env, NOW_MS);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'fcr_learning_authentication_failed' },
    });
  });

  it('fails closed when Chief has no FCR authentication secret configured', async () => {
    const input = await observation();
    const response = await handleFounderContentLearning(
      await signedRequest(input),
      { FCR_LEARNING_HMAC_KEY_ID: KEY_ID },
      NOW_MS,
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'fcr_learning_authentication_unconfigured' },
    });
  });

  it('still validates the signed observation contract after transport authentication', async () => {
    const input = await observation();
    input.authority.can_authorize_publish = true;
    const response = await handleFounderContentLearning(await signedRequest(input), env, NOW_MS);

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('invalid_founder_content_observation');
    expect(body.error.message).toContain('can_authorize_publish must be false');
  });
});
