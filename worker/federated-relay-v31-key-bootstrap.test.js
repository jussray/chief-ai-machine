import { describe, expect, it } from 'vitest';
import { canonicalizeRelayJcsV31, sha256HexV31 } from './federated-relay-v31.js';
import { handleFederatedRelayV31Runtime } from './federated-relay-v31-runtime.js';

function b64url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/=+$/u, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}
async function pair() {
  const keys = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  return {
    privateKey: keys.privateKey,
    publicJwk: await crypto.subtle.exportKey('jwk', keys.publicKey),
  };
}
async function fixture() {
  const fcr = await pair();
  const fcrSha = '1'.repeat(40);
  const chiefSha = '2'.repeat(40);
  const keyId = 'founder-control-room:relay-v3.1:ci:bootstrap-test';
  const validFrom = new Date(Date.now() - 60_000).toISOString();
  const validUntil = new Date(Date.now() + 15 * 60_000).toISOString();
  const payloadBody = JSON.stringify({ purpose: 'bootstrap-test' });
  const issued = new Date();
  const unsigned = {
    contract: 'juss/federated-agent-relay@v3.1',
    messageId: crypto.randomUUID(),
    ordering: {
      chainId: crypto.randomUUID(),
      sourceSequence: 0,
      chainPosition: 0,
      logicalOperationId: crypto.randomUUID(),
      relation: { type: 'root' },
    },
    source: { member: 'founder-control-room', repository: 'jussray/founder-control-room', branch: 'main', headSha: fcrSha },
    target: { member: 'chief-ai-machine', repository: 'jussray/chief-ai-machine', branch: 'main', headSha: chiefSha },
    issuedAt: issued.toISOString(),
    expiresAt: new Date(issued.getTime() + 4 * 60_000).toISOString(),
    nonce: crypto.randomUUID(),
    disposition: 'observe',
    subject: 'FCR bootstrap proof',
    payload: { contentType: 'application/json', body: payloadBody, sha256: await sha256HexV31(payloadBody) },
    contextFingerprint: await sha256HexV31(`bootstrap:${fcrSha}:${chiefSha}`),
    predecessorProofCookie: 'Q4R:v3.1:genesis',
    evidence: [],
    supersedesMessageIds: [],
  };
  const signature = await crypto.subtle.sign(
    'Ed25519',
    fcr.privateKey,
    new TextEncoder().encode(canonicalizeRelayJcsV31(unsigned)),
  );
  const envelope = {
    ...unsigned,
    signature: { algorithm: 'Ed25519', keyId, valueBase64Url: b64url(new Uint8Array(signature)) },
  };
  return {
    fcr,
    fcrSha,
    chiefSha,
    keyId,
    validFrom,
    validUntil,
    envelope,
    origin: 'https://deadbeef-founder-control-room.mcgill-raylene.workers.dev',
    env: {
      RELEASE_SHA: chiefSha,
      FEDERATED_RELAY_BRANCH: 'main',
      RELAY_SUPABASE_URL: 'https://relay.supabase.test',
      RELAY_SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    },
  };
}

describe('federated relay v3.1 FCR key bootstrap', () => {
  it('binds a missing FCR key to an allowed exact-SHA runtime before using it', async () => {
    const fx = await fixture();
    const state = { registerCalls: 0, sourceFetches: 0 };
    const fetchImpl = async (input, init = {}) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/rest/v1/federated_relay_v31_public_keys?')) return Response.json([]);
      if (url === `${fx.origin}/version`) {
        state.sourceFetches += 1;
        return Response.json({ gitSha: fx.fcrSha });
      }
      if (url === `${fx.origin}/api/federated-relay/v3`) {
        state.sourceFetches += 1;
        return Response.json({
          contract: 'juss/federated-agent-relay-key-query@v3.1',
          key: {
            member: 'founder-control-room',
            keyId: fx.keyId,
            publicKeyJwk: fx.fcr.publicJwk,
            state: 'active',
            validFrom: fx.validFrom,
            validUntil: fx.validUntil,
            revokedAt: null,
          },
          executionAuthorized: false,
          authorityTransferred: false,
          approvalCarriedForward: false,
        });
      }
      if (url.endsWith('/rest/v1/rpc/federated_relay_v31_register_observed_key')) {
        state.registerCalls += 1;
        const args = JSON.parse(init.body);
        expect(args.p_member).toBe('founder-control-room');
        expect(args.p_key_id).toBe(fx.keyId);
        expect(args.p_public_key_jwk.x).toBe(fx.fcr.publicJwk.x);
        return new Response(null, { status: 204 });
      }
      if (url.includes('/rest/v1/federated_relay_messages?')) return Response.json([]);
      if (url.startsWith('https://api.github.com/repos/jussray/founder-control-room/branches/')) {
        return Response.json({ commit: { sha: fx.fcrSha } });
      }
      if (url.startsWith('https://api.github.com/repos/jussray/chief-ai-machine/branches/')) {
        return Response.json({ commit: { sha: fx.chiefSha } });
      }
      throw new Error(`unexpected fetch: ${url}`);
    };

    const response = await handleFederatedRelayV31Runtime(new Request('https://chief.test/api/federated-relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Federated-Relay-Source-Origin': fx.origin,
      },
      body: canonicalizeRelayJcsV31(fx.envelope),
    }), fx.env, fetchImpl);
    const body = await response.json();

    expect(state.sourceFetches).toBe(2);
    expect(state.registerCalls).toBe(1);
    // The proof intentionally stops only after the bootstrapped key has passed
    // envelope verification; no Chief receipt signer is configured in this test.
    expect(response.status).toBe(503);
    expect(body.error).toBe('relay_receipt_signer_unconfigured');
  });

  it('rejects an unapproved source origin before fetching it', async () => {
    const fx = await fixture();
    let untrustedFetches = 0;
    const fetchImpl = async (input) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.includes('/rest/v1/federated_relay_v31_public_keys?')) return Response.json([]);
      if (url.startsWith('https://evil.example')) untrustedFetches += 1;
      throw new Error(`unexpected fetch: ${url}`);
    };

    const response = await handleFederatedRelayV31Runtime(new Request('https://chief.test/api/federated-relay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Federated-Relay-Source-Origin': 'https://evil.example',
      },
      body: canonicalizeRelayJcsV31(fx.envelope),
    }), fx.env, fetchImpl);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('relay_source_origin_not_allowed');
    expect(untrustedFetches).toBe(0);
  });
});
