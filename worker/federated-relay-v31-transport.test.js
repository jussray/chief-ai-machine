import { describe, expect, it } from 'vitest';
import { canonicalizeRelayJcsV31, sha256HexV31 } from './federated-relay-v31.js';
import { handleFederatedRelayV31Runtime } from './federated-relay-v31-runtime.js';
import { handleFederatedRelayV31Transport } from './federated-relay-v31-transport.js';

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
    privateJwk: await crypto.subtle.exportKey('jwk', pair.privateKey),
    publicJwk: await crypto.subtle.exportKey('jwk', pair.publicKey),
  };
}
async function signObject(unsigned, privateKey, keyId) {
  const signature = await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    new TextEncoder().encode(canonicalizeRelayJcsV31(unsigned)),
  );
  return { ...unsigned, signature: { algorithm: 'Ed25519', keyId, valueBase64Url: b64url(new Uint8Array(signature)) } };
}

async function fixture() {
  const fcr = await keyPair();
  const chief = await keyPair();
  const fcrSha = '1'.repeat(40);
  const chiefSha = '2'.repeat(40);
  const fcrKeyId = 'founder-control-room:relay-v3.1:ci:test';
  const chiefKeyId = 'chief-ai-machine:relay-v3.1:ci:test';
  const validFrom = new Date(Date.now() - 60_000).toISOString();
  const validUntil = new Date(Date.now() + 15 * 60_000).toISOString();
  const env = {
    RELEASE_SHA: chiefSha,
    FEDERATED_RELAY_BRANCH: 'main',
    RELAY_SUPABASE_URL: 'https://relay.supabase.test',
    RELAY_SUPABASE_SERVICE_ROLE_KEY: 'service-role-test',
    FEDERATED_RELAY_RECEIPT_PRIVATE_JWK: JSON.stringify(chief.privateJwk),
    FEDERATED_RELAY_RECEIPT_KEY_ID: chiefKeyId,
    FEDERATED_RELAY_PUBLIC_KEYS_JSON: JSON.stringify([
      { member: 'founder-control-room', keyId: fcrKeyId, publicKeyJwk: fcr.publicJwk, state: 'active', validFrom, validUntil, revokedAt: null },
      { member: 'chief-ai-machine', keyId: chiefKeyId, publicKeyJwk: chief.publicJwk, state: 'active', validFrom, validUntil, revokedAt: null },
    ]),
  };
  const body = JSON.stringify({ purpose: 'v31-roundtrip-test' });
  const issuedAt = new Date();
  const unsignedRoot = {
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
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + 4 * 60_000).toISOString(),
    nonce: crypto.randomUUID(),
    disposition: 'observe',
    subject: 'Exact-head v3.1 roundtrip test',
    payload: { contentType: 'application/json', body, sha256: await sha256HexV31(body) },
    contextFingerprint: await sha256HexV31(`test:${fcrSha}:${chiefSha}`),
    predecessorProofCookie: 'Q4R:v3.1:genesis',
    evidence: [],
    supersedesMessageIds: [],
  };
  const root = await signObject(unsignedRoot, fcr.privateKey, fcrKeyId);
  return { fcr, chief, fcrSha, chiefSha, fcrKeyId, chiefKeyId, validFrom, validUntil, env, root };
}

function fakeProvider(state) {
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('https://api.github.com/repos/jussray/founder-control-room/branches/')) {
      return Response.json({ commit: { sha: state.fcrSha } });
    }
    if (url.startsWith('https://api.github.com/repos/jussray/chief-ai-machine/branches/')) {
      return Response.json({ commit: { sha: state.chiefSha } });
    }
    if (url.includes('/rest/v1/federated_relay_messages?')) {
      return Response.json(state.storedRoot ? [state.storedRoot] : []);
    }
    if (url.includes('/rest/v1/federated_relay_v31_public_keys?')) {
      const key = state.fcrPublicKey;
      return Response.json(key ? [{
        member: 'founder-control-room', key_id: state.fcrKeyId, public_key_jwk: key,
        state: 'active', valid_from: state.validFrom, valid_until: state.validUntil, revoked_at: null,
      }] : []);
    }
    if (url.includes('/rest/v1/federated_relay_outbox?')) {
      const reply = state.replyEnvelope;
      return Response.json(reply ? [{
        message_id: reply.messageId,
        source_member: reply.source.member,
        source_repository: reply.source.repository,
        source_branch: reply.source.branch,
        source_head_sha: reply.source.headSha,
        source_key_id: reply.signature.keyId,
        target_member: reply.target.member,
        target_repository: reply.target.repository,
        target_branch: reply.target.branch,
        target_head_sha: reply.target.headSha,
        semantic_fingerprint: state.replySemanticFingerprint,
        delivery_fingerprint: state.replyDeliveryFingerprint,
        predecessor_proof_cookie: reply.predecessorProofCookie,
        successor_proof_cookie: state.replySuccessorProofCookie,
        delivery_status: 'signed',
      }] : []);
    }
    if (url.endsWith('/rest/v1/rpc/federated_relay_accept_v31')) {
      const args = JSON.parse(init.body);
      state.storedRoot = {
        message_id: args.p_message_id,
        semantic_fingerprint: args.p_semantic_fingerprint,
        delivery_fingerprint: args.p_delivery_fingerprint,
        receipt: args.p_receipt,
        status: 'accepted',
        superseded_by_message_id: null,
      };
      return Response.json([{ outcome: 'accepted', stored_receipt: args.p_receipt, current_state: 'accepted', superseded_by_message_id: null }]);
    }
    if (url.endsWith('/rest/v1/rpc/federated_relay_reserve_reply_v31')) {
      const args = JSON.parse(init.body);
      return Response.json([{
        message_id: state.replyEnvelope?.messageId ?? args.p_proposed_message_id,
        source_sequence: 0,
        predecessor_proof_cookie: state.storedRoot.receipt.successorProofCookie,
        delivery_status: state.replyEnvelope ? 'signed' : 'draft',
        envelope: state.replyEnvelope ?? null,
      }]);
    }
    if (url.endsWith('/rest/v1/rpc/federated_relay_finalize_reply_v31')) {
      const args = JSON.parse(init.body);
      state.replyEnvelope = args.p_envelope;
      state.replySemanticFingerprint = args.p_semantic_fingerprint;
      state.replyDeliveryFingerprint = args.p_delivery_fingerprint;
      state.replySuccessorProofCookie = args.p_successor_proof_cookie;
      return new Response(null, { status: 204 });
    }
    if (url.endsWith('/rest/v1/rpc/federated_relay_resolve_reply_v31')) {
      state.resolved = JSON.parse(init.body);
      return new Response(null, { status: 204 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

async function acceptedReplyFixture() {
  const fx = await fixture();
  const state = {
    fcrSha: fx.fcrSha,
    chiefSha: fx.chiefSha,
    fcrKeyId: fx.fcrKeyId,
    fcrPublicKey: fx.fcr.publicJwk,
    validFrom: fx.validFrom,
    validUntil: fx.validUntil,
    storedRoot: null,
    replyEnvelope: null,
    resolved: null,
  };
  const fetchImpl = fakeProvider(state);
  const rootResponse = await handleFederatedRelayV31Transport(new Request('https://chief.test/api/federated-relay', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: canonicalizeRelayJcsV31(fx.root),
  }), fx.env, fetchImpl);
  const rootBody = await rootResponse.json();
  const reply = rootBody.replyEnvelope;
  const acceptedAt = new Date().toISOString();
  const unsignedReceipt = {
    contract: 'juss/federated-agent-relay-receipt@v3.1',
    receiptId: crypto.randomUUID(),
    delivery: 'accepted',
    messageId: reply.messageId,
    semanticFingerprint: state.replySemanticFingerprint,
    deliveryFingerprint: state.replyDeliveryFingerprint,
    predecessorProofCookie: reply.predecessorProofCookie,
    successorProofCookie: state.replySuccessorProofCookie,
    sourceHeadSha: reply.source.headSha,
    targetObservedHeadSha: reply.target.headSha,
    sourceCommitEvidence: { repository: reply.source.repository, branch: reply.source.branch, headSha: reply.source.headSha, state: 'reachable_at_acceptance', checkedAt: acceptedAt },
    evidenceDigest: 'd'.repeat(64),
    acceptedKey: { member: 'chief-ai-machine', keyId: fx.chiefKeyId, stateAtAcceptance: 'active', validFrom: fx.validFrom, validUntil: fx.validUntil },
    acceptedAt,
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
    nextGate: 'test receipt',
    receiver: { ...reply.target, keyId: fx.fcrKeyId },
  };
  const receipt = await signObject(unsignedReceipt, fx.fcr.privateKey, fx.fcrKeyId);
  return { fx, state, fetchImpl, reply, receipt };
}

describe('federated relay v3.1 transport', () => {
  it('serves only the configured Chief public signing key', async () => {
    const fx = await fixture();
    const request = new Request('https://chief.test/api/federated-relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract: 'juss/federated-agent-relay-key-query@v3.1', member: 'chief-ai-machine', keyId: fx.chiefKeyId }),
    });
    const response = await handleFederatedRelayV31Transport(request, fx.env, async () => { throw new Error('network not expected'); });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.key.keyId).toBe(fx.chiefKeyId);
    expect(body.key.publicKeyJwk.x).toBe(fx.chief.publicJwk.x);
    expect(body.executionAuthorized).toBe(false);
  });

  it('rejects an oversized streaming body before runtime JSON buffering', async () => {
    const fx = await fixture();
    const oversized = `{"contract":"${'x'.repeat((512 * 1024) + 1)}"}`;
    const response = await handleFederatedRelayV31Runtime(new Request('https://chief.test/api/federated-relay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: oversized,
    }), fx.env, async () => { throw new Error('network not expected'); });
    const body = await response.json();
    expect(response.status).toBe(413);
    expect(body.error).toBe('relay_envelope_too_large');
  });

  it('accepts a canonical FCR root and returns one durable signed Chief reply across exact retries', async () => {
    const fx = await fixture();
    const state = { fcrSha: fx.fcrSha, chiefSha: fx.chiefSha, storedRoot: null, replyEnvelope: null, resolved: null };
    const fetchImpl = fakeProvider(state);
    const raw = canonicalizeRelayJcsV31(fx.root);
    const call = () => handleFederatedRelayV31Transport(new Request('https://chief.test/api/federated-relay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw,
    }), fx.env, fetchImpl);

    const first = await call();
    const firstBody = await first.json();
    expect(first.status).toBe(201);
    expect(firstBody.delivery).toBe('accepted');
    expect(firstBody.receipt.delivery).toBe('accepted');
    expect(firstBody.receipt.sourceCommitEvidence.state).toBe('reachable_at_acceptance');
    expect(firstBody.receipt.acceptedKey.stateAtAcceptance).toBe('active');
    expect(firstBody.receipt.receiver.keyId).toBe(fx.chiefKeyId);
    expect(firstBody.replyEnvelope.contract).toBe('juss/federated-agent-relay@v3.1');
    expect(firstBody.replyEnvelope.replyToMessageId).toBe(fx.root.messageId);
    expect(firstBody.replyEnvelope.source.member).toBe('chief-ai-machine');
    expect(firstBody.replyEnvelope.target.member).toBe('founder-control-room');
    expect(firstBody.replyEnvelope.ordering.sourceSequence).toBe(0);

    const firstReplyCanonical = canonicalizeRelayJcsV31(firstBody.replyEnvelope);
    const second = await call();
    const secondBody = await second.json();
    expect(second.status).toBe(200);
    expect(secondBody.delivery).toBe('duplicate');
    expect(canonicalizeRelayJcsV31(secondBody.replyEnvelope)).toBe(firstReplyCanonical);
  });

  it('persists delivery state only from the signed receipt', async () => {
    const { fx, state, fetchImpl, reply, receipt } = await acceptedReplyFixture();
    const tampered = {
      contract: 'juss/federated-agent-relay-delivery-ack@v3.1',
      messageId: reply.messageId,
      delivery: 'duplicate',
      receipt,
      currentState: 'revoked',
      supersededByMessageId: crypto.randomUUID(),
    };
    const rejected = await handleFederatedRelayV31Runtime(new Request('https://chief.test/api/federated-relay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(tampered),
    }), fx.env, fetchImpl);
    expect(rejected.status).toBe(409);
    expect(state.resolved).toBeNull();

    const valid = {
      ...tampered,
      currentState: 'accepted',
      supersededByMessageId: null,
    };
    const accepted = await handleFederatedRelayV31Runtime(new Request('https://chief.test/api/federated-relay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(valid),
    }), fx.env, fetchImpl);
    expect(accepted.status).toBe(200);
    expect(state.resolved.p_delivery).toBe('accepted');
    expect(state.resolved.p_current_state).toBe('accepted');
    expect(state.resolved.p_superseded_by_message_id).toBeNull();
  });
});
