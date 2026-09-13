import { RelayV31Error } from './federated-relay-v31.js';
import { handleFederatedRelayV31Transport, readBoundedRelayBodyV31 } from './federated-relay-v31-transport.js';

const KEY_QUERY_CONTRACT = 'juss/federated-agent-relay-key-query@v3.1';
const DELIVERY_ACK_CONTRACT = 'juss/federated-agent-relay-delivery-ack@v3.1';

function relayAssert(condition, code, status = 400) {
  if (!condition) throw new RelayV31Error(code, status);
}
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
async function supabaseGet(env, path, fetchImpl) {
  relayAssert(typeof env.RELAY_SUPABASE_URL === 'string' && typeof env.RELAY_SUPABASE_SERVICE_ROLE_KEY === 'string', 'relay_ledger_unconfigured', 503);
  const response = await fetchImpl(`${env.RELAY_SUPABASE_URL.replace(/\/$/u, '')}${path}`, {
    method: 'GET',
    headers: {
      apikey: env.RELAY_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.RELAY_SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
    },
  });
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!response.ok) throw new RelayV31Error(typeof data?.message === 'string' ? data.message : 'relay_database_error', response.status >= 500 ? 503 : 409);
  return data;
}
async function loadRelayKey(env, member, keyId, fetchImpl) {
  relayAssert(typeof member === 'string' && typeof keyId === 'string', 'relay_key_query_invalid', 400);
  const select = 'member,key_id,public_key_jwk,state,valid_from,valid_until,revoked_at';
  const data = await supabaseGet(
    env,
    `/rest/v1/federated_relay_v31_public_keys?member=eq.${encodeURIComponent(member)}&key_id=eq.${encodeURIComponent(keyId)}&select=${encodeURIComponent(select)}&limit=1`,
    fetchImpl,
  );
  const row = Array.isArray(data) ? data[0] : null;
  relayAssert(row, 'relay_key_unknown', 401);
  return {
    member: row.member,
    keyId: row.key_id,
    publicKeyJwk: row.public_key_jwk,
    state: row.state,
    validFrom: row.valid_from,
    validUntil: row.valid_until ?? null,
    revokedAt: row.revoked_at ?? null,
  };
}
function mergeRegistry(env, keys) {
  let existing = [];
  if (typeof env.FEDERATED_RELAY_PUBLIC_KEYS_JSON === 'string') {
    try {
      const parsed = JSON.parse(env.FEDERATED_RELAY_PUBLIC_KEYS_JSON);
      if (Array.isArray(parsed)) existing = parsed;
    } catch {
      existing = [];
    }
  }
  const replacements = new Set(keys.map((key) => `${key.member}\u0000${key.keyId}`));
  const merged = existing.filter((key) => !replacements.has(`${key?.member}\u0000${key?.keyId}`));
  merged.push(...keys);
  return { ...env, FEDERATED_RELAY_PUBLIC_KEYS_JSON: JSON.stringify(merged) };
}
async function loadOutbox(env, messageId, fetchImpl) {
  const select = [
    'message_id','source_member','source_repository','source_branch','source_head_sha','source_key_id',
    'target_member','target_repository','target_branch','target_head_sha','semantic_fingerprint','delivery_fingerprint',
    'predecessor_proof_cookie','successor_proof_cookie','delivery_status',
  ].join(',');
  const data = await supabaseGet(
    env,
    `/rest/v1/federated_relay_outbox?message_id=eq.${encodeURIComponent(messageId)}&select=${encodeURIComponent(select)}&limit=1`,
    fetchImpl,
  );
  const row = Array.isArray(data) ? data[0] : null;
  relayAssert(row, 'relay_outbox_missing', 409);
  return row;
}
function assertReceiptBindsOutbox(receipt, outbox) {
  relayAssert(isRecord(receipt), 'relay_delivery_ack_receipt_invalid');
  relayAssert(receipt.messageId === outbox.message_id, 'relay_delivery_ack_message_mismatch', 409);
  relayAssert(receipt.semanticFingerprint === outbox.semantic_fingerprint, 'relay_delivery_ack_semantic_mismatch', 409);
  relayAssert(receipt.deliveryFingerprint === outbox.delivery_fingerprint, 'relay_delivery_ack_delivery_mismatch', 409);
  relayAssert(receipt.predecessorProofCookie === outbox.predecessor_proof_cookie, 'relay_delivery_ack_predecessor_mismatch', 409);
  relayAssert(receipt.successorProofCookie === outbox.successor_proof_cookie, 'relay_delivery_ack_successor_mismatch', 409);
  relayAssert(receipt.sourceHeadSha === outbox.source_head_sha, 'relay_delivery_ack_source_head_mismatch', 409);
  relayAssert(receipt.targetObservedHeadSha === outbox.target_head_sha, 'relay_delivery_ack_target_head_mismatch', 409);
  relayAssert(receipt.receiver?.member === outbox.target_member
    && receipt.receiver?.repository === outbox.target_repository
    && receipt.receiver?.branch === outbox.target_branch
    && receipt.receiver?.headSha === outbox.target_head_sha,
  'relay_delivery_ack_receiver_mismatch', 409);
  relayAssert(receipt.sourceCommitEvidence?.repository === outbox.source_repository
    && receipt.sourceCommitEvidence?.branch === outbox.source_branch
    && receipt.sourceCommitEvidence?.headSha === outbox.source_head_sha
    && receipt.sourceCommitEvidence?.state === 'reachable_at_acceptance',
  'relay_delivery_ack_source_evidence_mismatch', 409);
  relayAssert(receipt.acceptedKey?.member === outbox.source_member
    && receipt.acceptedKey?.keyId === outbox.source_key_id,
  'relay_delivery_ack_accepted_key_mismatch', 409);
}

export async function handleFederatedRelayV31Runtime(request, env, fetchImpl = fetch) {
  if (request.method !== 'POST') return handleFederatedRelayV31Transport(request, env, fetchImpl);
  try {
    const raw = await readBoundedRelayBodyV31(request);
    let body;
    try { body = JSON.parse(raw); } catch { return handleFederatedRelayV31Transport(request, env, fetchImpl, raw); }

    if (body?.contract === KEY_QUERY_CONTRACT) {
      return handleFederatedRelayV31Transport(request, env, fetchImpl, raw);
    }

    if (body?.contract === DELIVERY_ACK_CONTRACT) {
      relayAssert(typeof body.messageId === 'string' && isRecord(body.receipt) && typeof body.receipt.signature?.keyId === 'string', 'relay_delivery_ack_invalid');
      const [outbox, receiptKey] = await Promise.all([
        loadOutbox(env, body.messageId, fetchImpl),
        loadRelayKey(env, 'founder-control-room', body.receipt.signature.keyId, fetchImpl),
      ]);
      assertReceiptBindsOutbox(body.receipt, outbox);
      return handleFederatedRelayV31Transport(request, mergeRegistry(env, [receiptKey]), fetchImpl, raw);
    }

    if (body?.contract === 'juss/federated-agent-relay@v3.1') {
      relayAssert(typeof body.source?.member === 'string' && typeof body.signature?.keyId === 'string', 'relay_signature_invalid');
      const sourceKey = await loadRelayKey(env, body.source.member, body.signature.keyId, fetchImpl);
      return handleFederatedRelayV31Transport(request, mergeRegistry(env, [sourceKey]), fetchImpl, raw);
    }

    return handleFederatedRelayV31Transport(request, env, fetchImpl, raw);
  } catch (error) {
    const known = error instanceof RelayV31Error;
    return Response.json({
      ok: false,
      error: known ? error.code : 'relay_runtime_guard_error',
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
