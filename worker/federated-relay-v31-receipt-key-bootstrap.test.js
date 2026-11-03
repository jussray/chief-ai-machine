import { describe, expect, it } from 'vitest';

import { bootstrapFcrPublicKeyV31 } from './federated-relay-v31-runtime.js';

const FCR_SHA = 'a'.repeat(40);
const FCR_ORIGIN = 'https://deadbeef-founder-control-room.mcgill-raylene.workers.dev';
const KEY_ID = 'founder-control-room:relay-v3.1:receiver:test';

function request() {
  return new Request('https://chief.example/api/federated-relay', {
    method: 'POST',
    headers: { 'X-Federated-Relay-Source-Origin': FCR_ORIGIN },
  });
}

describe('FCR receipt-key bootstrap', () => {
  it('observes only a public key from an exact-SHA FCR runtime and persists that public material', async () => {
    const registered = [];
    const publicKeyJwk = { kty: 'OKP', crv: 'Ed25519', x: 'public-x', ext: true };
    const fetchImpl = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === `${FCR_ORIGIN}/version`) {
        return Response.json({ gitSha: FCR_SHA });
      }
      if (url === `${FCR_ORIGIN}/api/federated-relay/v3`) {
        const body = JSON.parse(init.body);
        expect(body.keyId).toBe(KEY_ID);
        return Response.json({
          contract: 'juss/federated-agent-relay-key-query@v3.1',
          key: {
            member: 'founder-control-room',
            keyId: KEY_ID,
            publicKeyJwk,
            state: 'active',
            validFrom: '2026-09-13T23:00:00.000Z',
            validUntil: '2026-09-14T00:00:00.000Z',
            revokedAt: null,
          },
          executionAuthorized: false,
          authorityTransferred: false,
          approvalCarriedForward: false,
        });
      }
      if (url.endsWith('/rest/v1/rpc/federated_relay_v31_register_observed_key')) {
        registered.push(JSON.parse(init.body));
        return new Response(null, { status: 204 });
      }
      throw new Error(`unexpected fetch ${url}`);
    };
    const env = {
      RELAY_SUPABASE_URL: 'https://relay.supabase.test',
      RELAY_SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    };

    const key = await bootstrapFcrPublicKeyV31(request(), FCR_SHA, KEY_ID, env, fetchImpl);
    expect(key.publicKeyJwk).toEqual(publicKeyJwk);
    expect(registered).toHaveLength(1);
    expect(registered[0].p_member).toBe('founder-control-room');
    expect(registered[0].p_key_id).toBe(KEY_ID);
    expect(registered[0].p_public_key_jwk).toEqual(publicKeyJwk);
    expect(JSON.stringify(registered[0])).not.toContain('"d"');
  });

  it('rejects key bootstrap when the supplied FCR origin does not prove the expected exact SHA', async () => {
    const fetchImpl = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url === `${FCR_ORIGIN}/version`) return Response.json({ gitSha: 'b'.repeat(40) });
      throw new Error(`unexpected fetch ${url}`);
    };
    const env = {
      RELAY_SUPABASE_URL: 'https://relay.supabase.test',
      RELAY_SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    };

    await expect(bootstrapFcrPublicKeyV31(request(), FCR_SHA, KEY_ID, env, fetchImpl))
      .rejects.toThrowError(/relay_source_runtime_identity_stale/);
  });
});
