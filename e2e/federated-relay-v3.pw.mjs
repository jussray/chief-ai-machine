import { expect, test } from '@playwright/test';
import {
  FEDERATED_AGENT_RELAY_V3,
  canonicalizeRelayJsonV3,
  parseFederatedAgentRelayEnvelopeV3,
  sha256HexV3,
  signRelayEnvelopeV3,
  verifyRelayEnvelopeV3,
} from '../worker/federated-relay-v3-core.js';

const liveRequired = process.env.FEDERATED_RELAY_V3_LIVE_REQUIRED === 'true';
const chiefBaseURL = (process.env.PROOFMODE_BASE_URL || '').replace(/\/$/, '');
const fcrBaseURL = (process.env.FCR_FEDERATED_RELAY_BASE_URL || 'https://api.foundercontrolroom.org').replace(/\/$/, '');
const supabaseURL = (process.env.FCR_RELAY_SUPABASE_URL || 'https://oojzfmmywbvficgybaxd.supabase.co').replace(/\/$/, '');

function required(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) throw new Error(`BLOCKED_RELAY_SECRET_CONFIG: ${name} is required for live relay v3 proof`);
  return value;
}

function parsePrivateJwk() {
  let jwk;
  try { jwk = JSON.parse(required('FCR_FEDERATED_RELAY_PRIVATE_JWK')); }
  catch { throw new Error('BLOCKED_RELAY_SECRET_CONFIG: FCR_FEDERATED_RELAY_PRIVATE_JWK must be valid JSON'); }
  if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.d !== 'string' || typeof jwk.x !== 'string') {
    throw new Error('BLOCKED_RELAY_SECRET_CONFIG: FCR relay key must be Ed25519 private JWK');
  }
  return jwk;
}

async function db(path, { method = 'GET', body, prefer } = {}) {
  const secret = required('FCR_RELAY_SUPABASE_SECRET_KEY');
  const response = await fetch(`${supabaseURL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: secret,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  if (!response.ok) throw new Error(`Supabase ${path} failed with ${response.status}: ${String(raw).slice(0, 500)}`);
  return data;
}

async function ensureFcrKey(keyId, privateJwk) {
  const rows = await db(`federated_relay_public_keys?select=member,key_id,algorithm,public_key_jwk,state,valid_from,valid_until,revoked_at&key_id=eq.${encodeURIComponent(keyId)}&limit=1`);
  const publicKeyJwk = { kty: 'OKP', crv: 'Ed25519', x: privateJwk.x };
  if (Array.isArray(rows) && rows[0]) {
    expect(rows[0].member).toBe('founder-control-room');
    expect(rows[0].algorithm).toBe('Ed25519');
    expect(canonicalizeRelayJsonV3(rows[0].public_key_jwk)).toBe(canonicalizeRelayJsonV3(publicKeyJwk));
    expect(rows[0].state).not.toBe('revoked');
    return;
  }
  await db('federated_relay_public_keys', {
    method: 'POST',
    prefer: 'return=minimal',
    body: {
      member: 'founder-control-room',
      key_id: keyId,
      algorithm: 'Ed25519',
      public_key_jwk: publicKeyJwk,
      state: 'active',
      valid_from: process.env.FCR_FEDERATED_RELAY_KEY_VALID_FROM || '2026-09-13T00:00:00.000Z',
    },
  });
}

async function reserveFcrSequence(keyId) {
  const rows = await db('rpc/federated_relay_reserve_sequence_v3', {
    method: 'POST',
    body: { p_member: 'founder-control-room', p_key_id: keyId },
  });
  const value = Number(Array.isArray(rows) ? rows[0] : rows);
  expect(Number.isSafeInteger(value)).toBe(true);
  expect(value).toBeGreaterThanOrEqual(0);
  return value;
}

async function loadRelayKey(keyId) {
  const rows = await db(`federated_relay_public_keys?select=member,key_id,algorithm,public_key_jwk,state,valid_from,valid_until,revoked_at&key_id=eq.${encodeURIComponent(keyId)}&limit=1`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new Error(`relay public key not found: ${keyId}`);
  return {
    member: row.member,
    keyId: row.key_id,
    publicKeyJwk: row.public_key_jwk,
    state: row.state,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    revokedAt: row.revoked_at,
  };
}

test.describe('Federated relay v3 live durable roundtrip', () => {
  test.skip(!liveRequired, 'v3 live proof is not activated until FCR v3 + relay key secrets are deployed');

  test('FCR signs → Chief persists/replies → FCR persists → exact retry is idempotent', async ({ request }) => {
    expect(chiefBaseURL).not.toBe('');
    const privateJwk = parsePrivateJwk();
    const keyId = required('FCR_FEDERATED_RELAY_KEY_ID');
    await ensureFcrKey(keyId, privateJwk);

    const [fcrVersionResponse, chiefVersionResponse] = await Promise.all([
      request.get(`${fcrBaseURL}/version`),
      request.get(`${chiefBaseURL}/version`),
    ]);
    expect(fcrVersionResponse.status()).toBe(200);
    expect(chiefVersionResponse.status()).toBe(200);
    const fcrVersion = await fcrVersionResponse.json();
    const chiefVersion = await chiefVersionResponse.json();
    const fcrSha = String(fcrVersion.gitSha || '').toLowerCase();
    const chiefSha = String(chiefVersion.sha || '').toLowerCase();
    expect(fcrSha).toMatch(/^[0-9a-f]{40}$/);
    expect(chiefSha).toMatch(/^[0-9a-f]{40}$/);
    expect(chiefSha).toBe(process.env.EXPECTED_HEAD_SHA);

    const sourceSequence = await reserveFcrSequence(keyId);
    const messageId = crypto.randomUUID();
    const chainId = crypto.randomUUID();
    const logicalOperationId = crypto.randomUUID();
    const issuedAt = new Date();
    const payloadBody = JSON.stringify({ purpose: 'playwright-live-relay-v3-proof' });
    const contextFingerprint = await sha256HexV3(`${fcrSha}:${chiefSha}:${chainId}:${logicalOperationId}`);
    const unsigned = {
      contract: FEDERATED_AGENT_RELAY_V3,
      messageId,
      ordering: { chainId, sourceSequence, chainPosition: 0, logicalOperationId },
      source: {
        member: 'founder-control-room',
        repository: 'jussray/founder-control-room',
        branch: 'main',
        headSha: fcrSha,
      },
      target: {
        member: 'chief-ai-machine',
        repository: 'jussray/chief-ai-machine',
        branch: 'main',
        headSha: chiefSha,
      },
      issuedAt: issuedAt.toISOString(),
      expiresAt: new Date(issuedAt.getTime() + 5 * 60_000).toISOString(),
      nonce: crypto.randomUUID(),
      disposition: 'observe',
      subject: 'Playwright live federated relay v3 proof',
      payload: { contentType: 'application/json', body: payloadBody, sha256: await sha256HexV3(payloadBody) },
      contextFingerprint,
      predecessorProofCookie: `Q4R:v3:root:${await sha256HexV3(`${messageId}:${contextFingerprint}`)}`,
      evidence: [
        { ref: `github://jussray/founder-control-room@${fcrSha}`, state: 'verified' },
        { ref: `github://jussray/chief-ai-machine@${chiefSha}`, state: 'verified' },
      ],
      supersedesMessageIds: [],
    };
    const root = await signRelayEnvelopeV3(unsigned, privateJwk, keyId);

    const first = await request.post(`${chiefBaseURL}/api/federated-relay/v3`, { data: root });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();
    expect(firstBody.status).toBe('accepted');
    expect(firstBody.receipt.executionAuthorized).toBe(false);
    const reply = parseFederatedAgentRelayEnvelopeV3(firstBody.replyEnvelope);
    expect(reply.replyToMessageId).toBe(messageId);
    expect(reply.ordering.chainPosition).toBe(1);
    const chiefKey = await loadRelayKey(reply.signature.keyId);
    const verifiedReply = await verifyRelayEnvelopeV3({
      envelope: reply,
      key: chiefKey,
      expectedTarget: {
        member: 'founder-control-room',
        repository: 'jussray/founder-control-room',
        branch: 'main',
        headSha: fcrSha,
      },
    });
    expect(verifiedReply.receipt.predecessorProofCookie).toBe(firstBody.receipt.successorProofCookie);
    expect(verifiedReply.receipt.executionAuthorized).toBe(false);

    const fcrAccept = await request.post(`${fcrBaseURL}/api/federated-relay/v3`, { data: reply });
    expect(fcrAccept.status()).toBe(201);
    await expect(fcrAccept.json()).resolves.toMatchObject({ outcome: 'accepted', receipt: { executionAuthorized: false } });

    const retry = await request.post(`${chiefBaseURL}/api/federated-relay/v3`, { data: root });
    expect(retry.status()).toBe(200);
    const retryBody = await retry.json();
    expect(retryBody.status).toBe('duplicate');
    expect(canonicalizeRelayJsonV3(retryBody.replyEnvelope)).toBe(canonicalizeRelayJsonV3(reply));

    const fcrRetry = await request.post(`${fcrBaseURL}/api/federated-relay/v3`, { data: retryBody.replyEnvelope });
    expect(fcrRetry.status()).toBe(200);
    await expect(fcrRetry.json()).resolves.toMatchObject({ outcome: 'duplicate' });

    const chainRows = await db(`federated_relay_messages?select=message_id,chain_position,source_member,source_sequence,status&chain_id=eq.${encodeURIComponent(chainId)}&order=chain_position.asc`);
    expect(chainRows).toHaveLength(2);
    expect(chainRows[0]).toMatchObject({ chain_position: 0, source_member: 'founder-control-room', status: 'accepted' });
    expect(chainRows[1]).toMatchObject({ chain_position: 1, source_member: 'chief-ai-machine', status: 'accepted' });
  });
});
