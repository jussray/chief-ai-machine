import { describe, expect, it } from 'vitest';
import { canonicalizeRelayJcsV31 } from './federated-relay-v31.js';
import { handleFederatedRelayV31Runtime } from './federated-relay-v31-runtime.js';

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/u, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function keyPair() {
  const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return {
    privateKey: pair.privateKey,
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
  };
}

async function signRefresh(unsigned, privateKey, keyId) {
  const signature = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    new TextEncoder().encode(canonicalizeRelayJcsV31(unsigned)),
  );
  return {
    ...unsigned,
    signature: {
      algorithm: 'Ed25519',
      keyId,
      valueBase64Url: b64url(new Uint8Array(signature)),
    },
  };
}

async function fixture() {
  const fcr = await keyPair();
  const keyId = 'founder-control-room:relay-v3.1:ci:refresh-test';
  const validFrom = new Date(Date.now() - 60_000).toISOString();
  const validUntil = new Date(Date.now() + 15 * 60_000).toISOString();
  const parentMessageId = '11111111-1111-4111-8111-111111111111';
  const messageId = '22222222-2222-4222-8222-222222222222';
  const deliveryFingerprint = 'a'.repeat(64);
  const unsigned = {
    contract: 'juss/federated-agent-relay-reply-refresh@v3.1',
    parentMessageId,
    messageId,
    deliveryFingerprint,
    requestedAt: new Date().toISOString(),
  };
  const body = await signRefresh(unsigned, fcr.privateKey, keyId);
  const env = {
    RELEASE_SHA: 'b'.repeat(40),
    RELAY_SUPABASE_URL: 'https://relay.supabase.test',
    RELAY_SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
  };
  return { fcr, keyId, validFrom, validUntil, parentMessageId, messageId, deliveryFingerprint, body, env };
}

function fakeProvider(fx, state) {
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.includes('/rest/v1/federated_relay_v31_public_keys?')) {
      return Response.json([{
        member: 'founder-control-room',
        key_id: fx.keyId,
        public_key_jwk: fx.fcr.publicJwk,
        state: 'active',
        valid_from: fx.validFrom,
        valid_until: fx.validUntil,
        revoked_at: null,
      }]);
    }
    if (url.endsWith('/rest/v1/rpc/federated_relay_refresh_expired_reply_v31')) {
      state.refreshCalls += 1;
      state.refreshArgs = JSON.parse(init.body);
      return Response.json([{
        message_id: fx.messageId,
        source_sequence: 7,
        predecessor_proof_cookie: `Q4R:v3.1:${'b'.repeat(64)}`,
        resign_count: 1,
      }]);
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

describe('federated relay v3.1 expired-reply refresh', () => {
  it('accepts only an FCR-signed refresh bound to the exact pending delivery fingerprint', async () => {
    const fx = await fixture();
    const state = { refreshCalls: 0, refreshArgs: null };
    const response = await handleFederatedRelayV31Runtime(new Request('https://chief.test/api/federated-relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fx.body),
    }), fx.env, fakeProvider(fx, state));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.refreshed).toBe(true);
    expect(body.messageId).toBe(fx.messageId);
    expect(body.sourceSequence).toBe(7);
    expect(body.resignCount).toBe(1);
    expect(body.executionAuthorized).toBe(false);
    expect(body.authorityTransferred).toBe(false);
    expect(body.approvalCarriedForward).toBe(false);
    expect(state.refreshCalls).toBe(1);
    expect(state.refreshArgs).toEqual({
      p_parent_message_id: fx.parentMessageId,
      p_message_id: fx.messageId,
      p_expected_delivery_fingerprint: fx.deliveryFingerprint,
    });
  });

  it('rejects a tampered fingerprint before the refresh RPC can mutate durable state', async () => {
    const fx = await fixture();
    const state = { refreshCalls: 0, refreshArgs: null };
    const tampered = { ...fx.body, deliveryFingerprint: 'c'.repeat(64) };
    const response = await handleFederatedRelayV31Runtime(new Request('https://chief.test/api/federated-relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tampered),
    }), fx.env, fakeProvider(fx, state));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('relay_signature_invalid');
    expect(state.refreshCalls).toBe(0);
  });
});
