import {
  RelayV31Error,
  assertEnvelopeV31,
  canonicalizeRelayJcsV31,
  deliveryFingerprintV31,
  parseCanonicalEnvelopeV31,
  sha256HexV31,
} from './federated-relay-v31.js';

const RELAY_CONTRACT = 'juss/federated-agent-relay@v3.1';
const RECEIPT_CONTRACT = 'juss/federated-agent-relay-receipt@v3.1';
const KEY_QUERY_CONTRACT = 'juss/federated-agent-relay-key-query@v3.1';
const DELIVERY_ACK_CONTRACT = 'juss/federated-agent-relay-delivery-ack@v3.1';
const REPLY_REFRESH_CONTRACT = 'juss/federated-agent-relay-reply-refresh@v3.1';
const MAX_ENVELOPE_BYTES = 512 * 1024;
const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const KEY_ID = /^[A-Za-z0-9._:-]{3,200}$/;
const BASE64URL_64 = /^[A-Za-z0-9_-]{86}$/;

function relayAssert(condition, code, status = 400) {
  if (!condition) throw new RelayV31Error(code, status);
}
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value, allowed, code) {
  relayAssert(isRecord(value), code);
  const expected = new Set(allowed);
  relayAssert(Object.keys(value).every((key) => expected.has(key)), `${code}_field`);
}
function encodeBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/u, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function decodeBase64Url64(value) {
  relayAssert(typeof value === 'string' && BASE64URL_64.test(value), 'relay_signature_base64url_invalid', 401);
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(`${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  relayAssert(bytes.byteLength === 64, 'relay_signature_length_invalid', 401);
  relayAssert(encodeBase64Url(bytes) === value, 'relay_signature_base64url_noncanonical', 401);
  return bytes;
}
async function taggedDigest(tag, parts) {
  const encoder = new TextEncoder();
  const framed = [tag, '\u0000'];
  for (const part of parts) framed.push(String(encoder.encode(part).byteLength), '\u0000', part, '\u0000');
  return sha256HexV31(framed.join(''));
}
async function semanticFingerprintV31(envelope) {
  return sha256HexV31(canonicalizeRelayJcsV31({
    contract: envelope.contract,
    logicalOperationId: envelope.ordering.logicalOperationId,
    relation: envelope.ordering.relation,
    source: envelope.source,
    target: envelope.target,
    disposition: envelope.disposition,
    subject: envelope.subject,
    payload: envelope.payload,
    contextFingerprint: envelope.contextFingerprint,
    evidence: envelope.evidence,
    supersedesMessageIds: envelope.supersedesMessageIds,
  }));
}
async function evidenceDigestV31(evidence) {
  return taggedDigest('juss.federated-relay.evidence.v3.1', [canonicalizeRelayJcsV31(evidence)]);
}
async function successorProofCookieV31(envelope, deliveryFingerprint) {
  const digest = await taggedDigest('juss.federated-relay.cookie.v3.1', [
    envelope.ordering.chainId,
    envelope.predecessorProofCookie,
    deliveryFingerprint,
    envelope.nonce,
    envelope.source.member,
    envelope.target.member,
  ]);
  return `Q4R:v3.1:${digest}`;
}
function localIdentity(env) {
  const sha = [env?.RELEASE_SHA, env?.GITHUB_SHA, env?.WORKERS_CI_COMMIT_SHA]
    .find((value) => typeof value === 'string' && SHA40.test(value));
  relayAssert(sha, 'relay_runtime_sha_unavailable', 503);
  return {
    member: 'chief-ai-machine',
    repository: 'jussray/chief-ai-machine',
    branch: env?.FEDERATED_RELAY_BRANCH || 'main',
    headSha: sha,
  };
}
function registry(env) {
  relayAssert(typeof env.FEDERATED_RELAY_PUBLIC_KEYS_JSON === 'string', 'relay_key_registry_unconfigured', 503);
  let keys;
  try { keys = JSON.parse(env.FEDERATED_RELAY_PUBLIC_KEYS_JSON); } catch { throw new RelayV31Error('relay_key_registry_invalid', 503); }
  relayAssert(Array.isArray(keys), 'relay_key_registry_invalid', 503);
  return keys;
}
function keyWindowUsable(key, member, issuedAt, acceptedAt) {
  relayAssert(key?.member === member, 'relay_key_member_mismatch', 401);
  relayAssert(key.state === 'active' || key.state === 'retiring', 'relay_key_revoked', 401);
  relayAssert(!key.revokedAt, 'relay_key_revoked', 401);
  const issued = Date.parse(issuedAt);
  const accepted = Date.parse(acceptedAt);
  const validFrom = Date.parse(key.validFrom);
  const validUntil = key.validUntil == null ? Number.POSITIVE_INFINITY : Date.parse(key.validUntil);
  relayAssert(Number.isFinite(issued) && Number.isFinite(accepted) && Number.isFinite(validFrom)
    && issued >= validFrom && accepted >= validFrom && issued <= validUntil && accepted <= validUntil,
  'relay_key_outside_window', 401);
}
async function verifyDetached(unsigned, signature, key) {
  relayAssert(signature?.algorithm === 'Ed25519' && signature.keyId === key.keyId, 'relay_signature_key_mismatch', 401);
  const publicKey = await crypto.subtle.importKey('jwk', key.publicKeyJwk, { name: 'Ed25519' }, false, ['verify']);
  const valid = await crypto.subtle.verify(
    'Ed25519',
    publicKey,
    decodeBase64Url64(signature.valueBase64Url),
    new TextEncoder().encode(canonicalizeRelayJcsV31(unsigned)),
  );
  relayAssert(valid, 'relay_signature_invalid', 401);
}
async function verifyEnvelopeSignature(envelope, env, acceptedAt) {
  const key = registry(env).find((candidate) => candidate.member === envelope.source.member && candidate.keyId === envelope.signature.keyId);
  relayAssert(key, 'relay_key_unknown', 401);
  keyWindowUsable(key, envelope.source.member, envelope.issuedAt, acceptedAt);
  const { signature, ...unsigned } = envelope;
  await verifyDetached(unsigned, signature, key);
  return key;
}
function signerMaterial(env) {
  relayAssert(typeof env.FEDERATED_RELAY_RECEIPT_PRIVATE_JWK === 'string'
    && typeof env.FEDERATED_RELAY_RECEIPT_KEY_ID === 'string'
    && KEY_ID.test(env.FEDERATED_RELAY_RECEIPT_KEY_ID), 'relay_receipt_signer_unconfigured', 503);
  let privateJwk;
  try { privateJwk = JSON.parse(env.FEDERATED_RELAY_RECEIPT_PRIVATE_JWK); } catch { throw new RelayV31Error('relay_receipt_signer_invalid', 503); }
  relayAssert(privateJwk?.kty === 'OKP' && privateJwk?.crv === 'Ed25519' && typeof privateJwk.x === 'string' && typeof privateJwk.d === 'string', 'relay_receipt_signer_invalid', 503);
  const keyId = env.FEDERATED_RELAY_RECEIPT_KEY_ID;
  const registered = typeof env.FEDERATED_RELAY_PUBLIC_KEYS_JSON === 'string'
    ? registry(env).find((candidate) => candidate.member === 'chief-ai-machine' && candidate.keyId === keyId)
    : null;
  const validFrom = registered?.validFrom ?? env.FEDERATED_RELAY_RECEIPT_KEY_VALID_FROM;
  const validUntil = registered?.validUntil ?? env.FEDERATED_RELAY_RECEIPT_KEY_VALID_UNTIL ?? null;
  const state = registered?.state ?? 'active';
  const revokedAt = registered?.revokedAt ?? null;
  relayAssert(typeof validFrom === 'string' && Number.isFinite(Date.parse(validFrom)), 'relay_receipt_key_window_unconfigured', 503);
  relayAssert(validUntil == null || (typeof validUntil === 'string' && Number.isFinite(Date.parse(validUntil))), 'relay_receipt_key_window_invalid', 503);
  if (registered?.publicKeyJwk?.x) relayAssert(registered.publicKeyJwk.x === privateJwk.x, 'relay_receipt_signer_mismatch', 503);
  relayAssert(state === 'active' || state === 'retiring', 'relay_receipt_key_not_current', 503);
  relayAssert(!revokedAt, 'relay_receipt_key_not_current', 503);
  return {
    privateJwk,
    key: {
      member: 'chief-ai-machine',
      keyId,
      publicKeyJwk: { kty: 'OKP', crv: 'Ed25519', x: privateJwk.x, ext: true },
      state,
      validFrom,
      validUntil,
      revokedAt: null,
    },
  };
}
async function signObject(unsigned, env) {
  const material = signerMaterial(env);
  const privateKey = await crypto.subtle.importKey('jwk', material.privateJwk, { name: 'Ed25519' }, false, ['sign']);
  const bytes = new Uint8Array(await crypto.subtle.sign(
    'Ed25519',
    privateKey,
    new TextEncoder().encode(canonicalizeRelayJcsV31(unsigned)),
  ));
  return { signature: { algorithm: 'Ed25519', keyId: material.key.keyId, valueBase64Url: encodeBase64Url(bytes) }, key: material.key };
}
async function currentGitHubHead(repository, branch, fetchImpl) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/branches/${encodeURIComponent(branch)}`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'chief-federated-relay-v31' },
  });
  if (response.status === 404) return null;
  relayAssert(response.ok, 'relay_repository_head_provider_failed', 503);
  const body = await response.json();
  return typeof body?.commit?.sha === 'string' ? body.commit.sha.toLowerCase() : null;
}
async function supabaseRequest(env, path, init = {}, fetchImpl = fetch) {
  relayAssert(typeof env.RELAY_SUPABASE_URL === 'string' && typeof env.RELAY_SUPABASE_SERVICE_ROLE_KEY === 'string', 'relay_ledger_unconfigured', 503);
  const response = await fetchImpl(`${env.RELAY_SUPABASE_URL.replace(/\/$/u, '')}${path}`, {
    ...init,
    headers: {
      apikey: env.RELAY_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.RELAY_SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!response.ok) throw new RelayV31Error(typeof data?.message === 'string' ? data.message : 'relay_database_error', response.status >= 500 ? 503 : 409);
  return data;
}
async function findStored(env, messageId, fetchImpl) {
  const select = 'message_id,semantic_fingerprint,delivery_fingerprint,receipt,status,superseded_by_message_id';
  const data = await supabaseRequest(env,
    `/rest/v1/federated_relay_messages?message_id=eq.${encodeURIComponent(messageId)}&select=${encodeURIComponent(select)}&limit=1`,
    { method: 'GET', headers: { Accept: 'application/json' } }, fetchImpl);
  return Array.isArray(data) && data.length ? data[0] : null;
}
async function canonicalReceipt(envelope, verified, env, acceptedAt) {
  const local = localIdentity(env);
  const signed = await signObject({}, env);
  const unsigned = {
    contract: RECEIPT_CONTRACT,
    receiptId: crypto.randomUUID(),
    delivery: 'accepted',
    messageId: envelope.messageId,
    semanticFingerprint: verified.semanticFingerprint,
    deliveryFingerprint: verified.deliveryFingerprint,
    predecessorProofCookie: envelope.predecessorProofCookie,
    successorProofCookie: verified.successorProofCookie,
    sourceHeadSha: envelope.source.headSha,
    targetObservedHeadSha: local.headSha,
    sourceCommitEvidence: {
      repository: envelope.source.repository,
      branch: envelope.source.branch,
      headSha: envelope.source.headSha,
      state: 'reachable_at_acceptance',
      checkedAt: acceptedAt,
    },
    evidenceDigest: verified.evidenceDigest,
    acceptedKey: {
      member: verified.key.member,
      keyId: verified.key.keyId,
      stateAtAcceptance: verified.key.state,
      validFrom: verified.key.validFrom,
      validUntil: verified.key.validUntil ?? null,
    },
    acceptedAt,
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
    nextGate: 'Relay acceptance is evidence transport only. Local policy, evidence verification, and explicit local approval remain required before mutation.',
    receiver: { ...local, keyId: signed.key.keyId },
  };
  const result = await signObject(unsigned, env);
  return { ...unsigned, signature: result.signature };
}
async function acceptEnvelope(envelope, env, fetchImpl) {
  const deliveryFingerprint = await deliveryFingerprintV31(envelope);
  const existing = await findStored(env, envelope.messageId, fetchImpl);
  if (existing) {
    relayAssert(existing.delivery_fingerprint === deliveryFingerprint, 'relay_message_id_collision', 409);
    return { delivery: 'duplicate', receipt: existing.receipt, currentState: existing.status, supersededByMessageId: existing.superseded_by_message_id ?? null };
  }

  const issued = Date.parse(envelope.issuedAt);
  const expires = Date.parse(envelope.expiresAt);
  relayAssert(Number.isFinite(issued) && Number.isFinite(expires) && expires > issued && expires - issued <= 5 * 60_000, 'relay_invalid_expiry');
  relayAssert(await sha256HexV31(envelope.payload.body) === envelope.payload.sha256, 'relay_payload_digest_mismatch');
  const local = localIdentity(env);
  relayAssert(envelope.target.member === local.member && envelope.target.repository === local.repository
    && envelope.target.branch === local.branch && envelope.target.headSha === local.headSha, 'relay_target_head_stale', 409);

  const preliminaryKey = registry(env).find((candidate) => candidate.member === envelope.source.member && candidate.keyId === envelope.signature.keyId);
  relayAssert(preliminaryKey, 'relay_key_unknown', 401);
  keyWindowUsable(preliminaryKey, envelope.source.member, envelope.issuedAt, envelope.issuedAt);
  const { signature, ...unsignedEnvelope } = envelope;
  await verifyDetached(unsignedEnvelope, signature, preliminaryKey);

  const [sourceHead, targetHead] = await Promise.all([
    currentGitHubHead(envelope.source.repository, envelope.source.branch, fetchImpl),
    currentGitHubHead(local.repository, local.branch, fetchImpl),
  ]);
  relayAssert(sourceHead === envelope.source.headSha, 'relay_source_head_stale', 409);
  relayAssert(targetHead === local.headSha, 'relay_target_branch_stale', 409);

  const acceptedAt = new Date().toISOString();
  const key = await verifyEnvelopeSignature(envelope, env, acceptedAt);
  relayAssert(Date.parse(acceptedAt) <= expires, 'relay_expired', 409);
  const semanticFingerprint = await semanticFingerprintV31(envelope);
  const evidenceDigest = await evidenceDigestV31(envelope.evidence);
  const successorProofCookie = await successorProofCookieV31(envelope, deliveryFingerprint);
  const receipt = await canonicalReceipt(envelope, { semanticFingerprint, deliveryFingerprint, evidenceDigest, successorProofCookie, key }, env, acceptedAt);
  const relation = envelope.ordering.relation;
  const rpc = await supabaseRequest(env, '/rest/v1/rpc/federated_relay_accept_v31', {
    method: 'POST',
    body: JSON.stringify({
      p_contract: envelope.contract,
      p_message_id: envelope.messageId,
      p_semantic_fingerprint: semanticFingerprint,
      p_delivery_fingerprint: deliveryFingerprint,
      p_receipt_id: receipt.receiptId,
      p_chain_id: envelope.ordering.chainId,
      p_chain_position: envelope.ordering.chainPosition,
      p_relation_type: relation.type,
      p_parent_message_id: relation.type === 'root' ? null : relation.parentMessageId,
      p_logical_operation_id: envelope.ordering.logicalOperationId,
      p_source_member: envelope.source.member,
      p_source_repository: envelope.source.repository,
      p_source_branch: envelope.source.branch,
      p_source_head_sha: envelope.source.headSha,
      p_source_key_id: envelope.signature.keyId,
      p_source_sequence: envelope.ordering.sourceSequence,
      p_target_member: envelope.target.member,
      p_target_repository: envelope.target.repository,
      p_target_branch: envelope.target.branch,
      p_target_head_sha: envelope.target.headSha,
      p_nonce: envelope.nonce,
      p_reply_to_message_id: envelope.replyToMessageId ?? null,
      p_predecessor_proof_cookie: envelope.predecessorProofCookie,
      p_successor_proof_cookie: successorProofCookie,
      p_payload_sha256: envelope.payload.sha256,
      p_evidence_digest: evidenceDigest,
      p_accepted_key_state: receipt.acceptedKey,
      p_issued_at: envelope.issuedAt,
      p_expires_at: envelope.expiresAt,
      p_envelope: envelope,
      p_receipt: receipt,
      p_supersedes_message_ids: envelope.supersedesMessageIds,
    }),
  }, fetchImpl);
  const row = Array.isArray(rpc) ? rpc[0] : rpc;
  relayAssert(row && ['accepted','duplicate'].includes(row.outcome) && row.stored_receipt, 'relay_database_result_invalid', 503);
  return {
    delivery: row.outcome,
    receipt: row.stored_receipt,
    currentState: row.current_state,
    supersededByMessageId: row.superseded_by_message_id ?? null,
  };
}
async function reserveReply(root, result, env, fetchImpl) {
  relayAssert(root.ordering.relation.type === 'root', 'relay_auto_reply_requires_root');
  relayAssert(root.source.member === 'founder-control-room' && root.target.member === 'chief-ai-machine', 'relay_auto_reply_pair_invalid');
  const signer = signerMaterial(env);
  const rpc = await supabaseRequest(env, '/rest/v1/rpc/federated_relay_reserve_reply_v31', {
    method: 'POST',
    body: JSON.stringify({
      p_parent_message_id: root.messageId,
      p_proposed_message_id: crypto.randomUUID(),
      p_source_key_id: signer.key.keyId,
    }),
  }, fetchImpl);
  const row = Array.isArray(rpc) ? rpc[0] : rpc;
  relayAssert(row && typeof row.message_id === 'string' && Number.isSafeInteger(Number(row.source_sequence)), 'relay_reply_reservation_invalid', 503);
  relayAssert(row.predecessor_proof_cookie === result.receipt.successorProofCookie, 'relay_reply_predecessor_cookie_mismatch', 503);
  if (row.envelope) {
    assertEnvelopeV31(row.envelope);
    return row.envelope;
  }

  const issuedAt = new Date();
  const payloadBody = JSON.stringify({ purpose: 'chief-fcr-live-relay-v3.1-reply', acceptedMessageId: root.messageId });
  const unsigned = {
    contract: RELAY_CONTRACT,
    messageId: row.message_id,
    replyToMessageId: root.messageId,
    ordering: {
      chainId: root.ordering.chainId,
      sourceSequence: Number(row.source_sequence),
      chainPosition: root.ordering.chainPosition + 1,
      logicalOperationId: root.ordering.logicalOperationId,
      relation: { type: 'reply', parentMessageId: root.messageId },
    },
    source: root.target,
    target: root.source,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + 4 * 60_000).toISOString(),
    nonce: crypto.randomUUID(),
    disposition: 'observe',
    subject: 'Chief v3.1 signed relay reply',
    payload: { contentType: 'application/json', body: payloadBody, sha256: await sha256HexV31(payloadBody) },
    contextFingerprint: await sha256HexV31(`chief-v31-reply:${root.ordering.chainId}:${root.ordering.logicalOperationId}:${root.messageId}`),
    predecessorProofCookie: row.predecessor_proof_cookie,
    evidence: [{
      locator: { provider: 'juss-proof', ref: `relay-receipt:${result.receipt.receiptId}` },
      state: 'verified',
      proofReceiptId: result.receipt.receiptId,
    }],
    supersedesMessageIds: [],
  };
  const signed = await signObject(unsigned, env);
  const envelope = { ...unsigned, signature: signed.signature };
  assertEnvelopeV31(envelope);
  const semanticFingerprint = await semanticFingerprintV31(envelope);
  const deliveryFingerprint = await deliveryFingerprintV31(envelope);
  const successorProofCookie = await successorProofCookieV31(envelope, deliveryFingerprint);
  await supabaseRequest(env, '/rest/v1/rpc/federated_relay_finalize_reply_v31', {
    method: 'POST',
    body: JSON.stringify({
      p_message_id: envelope.messageId,
      p_semantic_fingerprint: semanticFingerprint,
      p_delivery_fingerprint: deliveryFingerprint,
      p_successor_proof_cookie: successorProofCookie,
      p_envelope: envelope,
    }),
  }, fetchImpl);
  return envelope;
}
function publicChiefKey(env, keyId) {
  const signer = signerMaterial(env);
  relayAssert(keyId === signer.key.keyId, 'relay_key_unknown', 404);
  return signer.key;
}
async function verifyFcrReceipt(receipt, expectedMessageId, env) {
  relayAssert(isRecord(receipt) && receipt.contract === RECEIPT_CONTRACT && receipt.delivery === 'accepted'
    && receipt.messageId === expectedMessageId, 'relay_delivery_ack_receipt_invalid', 400);
  relayAssert(receipt.executionAuthorized === false && receipt.authorityTransferred === false && receipt.approvalCarriedForward === false,
    'relay_delivery_ack_authority_invalid', 400);
  relayAssert(receipt.receiver?.member === 'founder-control-room' && receipt.receiver?.repository === 'jussray/founder-control-room',
    'relay_delivery_ack_receiver_invalid', 400);
  const key = registry(env).find((candidate) => candidate.member === 'founder-control-room' && candidate.keyId === receipt.signature?.keyId);
  relayAssert(key, 'relay_delivery_ack_key_unknown', 401);
  keyWindowUsable(key, 'founder-control-room', receipt.acceptedAt, receipt.acceptedAt);
  const { signature, ...unsigned } = receipt;
  await verifyDetached(unsigned, signature, key);
}
async function handleDeliveryAck(body, env, fetchImpl) {
  exactKeys(body, ['contract','messageId','delivery','receipt','currentState','supersededByMessageId'], 'relay_delivery_ack_invalid');
  relayAssert(body.contract === DELIVERY_ACK_CONTRACT, 'relay_delivery_ack_contract_invalid');
  relayAssert(body.delivery === 'accepted' || body.delivery === 'duplicate', 'relay_delivery_ack_result_invalid');
  relayAssert(body.currentState === 'accepted', 'relay_delivery_ack_unsigned_state_rejected', 409);
  relayAssert(body.supersededByMessageId === null, 'relay_delivery_ack_unsigned_supersession_rejected', 409);
  await verifyFcrReceipt(body.receipt, body.messageId, env);

  await supabaseRequest(env, '/rest/v1/rpc/federated_relay_resolve_reply_v31', {
    method: 'POST',
    body: JSON.stringify({
      p_message_id: body.messageId,
      p_delivery: body.receipt.delivery,
      p_receipt: body.receipt,
      p_current_state: 'accepted',
      p_superseded_by_message_id: null,
    }),
  }, fetchImpl);
  return Response.json({
    contract: DELIVERY_ACK_CONTRACT,
    resolved: true,
    messageId: body.messageId,
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
async function handleReplyRefresh(body, env, fetchImpl) {
  exactKeys(body, ['contract','parentMessageId','messageId','deliveryFingerprint','requestedAt','signature'], 'relay_reply_refresh_invalid');
  relayAssert(body.contract === REPLY_REFRESH_CONTRACT, 'relay_reply_refresh_contract_invalid');
  relayAssert(typeof body.parentMessageId === 'string' && UUID.test(body.parentMessageId), 'relay_reply_refresh_parent_invalid');
  relayAssert(typeof body.messageId === 'string' && UUID.test(body.messageId), 'relay_reply_refresh_message_invalid');
  relayAssert(typeof body.deliveryFingerprint === 'string' && SHA256.test(body.deliveryFingerprint), 'relay_reply_refresh_fingerprint_invalid');
  relayAssert(typeof body.requestedAt === 'string', 'relay_reply_refresh_time_invalid');
  const requestedAtMs = Date.parse(body.requestedAt);
  relayAssert(Number.isFinite(requestedAtMs) && new Date(requestedAtMs).toISOString() === body.requestedAt, 'relay_reply_refresh_time_invalid');
  const now = Date.now();
  relayAssert(requestedAtMs <= now + 30_000 && requestedAtMs >= now - 2 * 60_000, 'relay_reply_refresh_time_stale', 409);
  relayAssert(body.signature?.algorithm === 'Ed25519' && typeof body.signature?.keyId === 'string', 'relay_reply_refresh_signature_invalid', 401);
  const key = registry(env).find((candidate) => candidate.member === 'founder-control-room' && candidate.keyId === body.signature.keyId);
  relayAssert(key, 'relay_reply_refresh_key_unknown', 401);
  keyWindowUsable(key, 'founder-control-room', body.requestedAt, body.requestedAt);
  const { signature, ...unsigned } = body;
  await verifyDetached(unsigned, signature, key);

  const rpc = await supabaseRequest(env, '/rest/v1/rpc/federated_relay_refresh_expired_reply_v31', {
    method: 'POST',
    body: JSON.stringify({
      p_parent_message_id: body.parentMessageId,
      p_message_id: body.messageId,
      p_expected_delivery_fingerprint: body.deliveryFingerprint,
    }),
  }, fetchImpl);
  const row = Array.isArray(rpc) ? rpc[0] : rpc;
  relayAssert(row && row.message_id === body.messageId && Number.isSafeInteger(Number(row.source_sequence)), 'relay_reply_refresh_result_invalid', 503);
  return Response.json({
    contract: REPLY_REFRESH_CONTRACT,
    refreshed: true,
    messageId: row.message_id,
    sourceSequence: Number(row.source_sequence),
    resignCount: Number(row.resign_count),
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
async function handleKeyQuery(body, env) {
  exactKeys(body, ['contract','member','keyId'], 'relay_key_query_invalid');
  relayAssert(body.contract === KEY_QUERY_CONTRACT && body.member === 'chief-ai-machine' && typeof body.keyId === 'string', 'relay_key_query_invalid');
  return Response.json({
    contract: KEY_QUERY_CONTRACT,
    key: publicChiefKey(env, body.keyId),
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

export async function readBoundedRelayBodyV31(request) {
  const rawLength = request.headers.get('content-length');
  if (rawLength !== null) {
    const contentLength = Number(rawLength);
    relayAssert(Number.isFinite(contentLength) && contentLength >= 0, 'relay_content_length_invalid', 400);
    relayAssert(contentLength <= MAX_ENVELOPE_BYTES, 'relay_envelope_too_large', 413);
  }
  if (!request.body) return '';
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_ENVELOPE_BYTES) {
      await reader.cancel();
      throw new RelayV31Error('relay_envelope_too_large', 413);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new RelayV31Error('relay_utf8_invalid', 400);
  }
}

export async function handleFederatedRelayV31Transport(request, env, fetchImpl = fetch, rawBody = undefined) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  try {
    relayAssert((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() === 'application/json', 'relay_content_type', 415);
    const raw = rawBody === undefined ? await readBoundedRelayBodyV31(request) : rawBody;
    relayAssert(typeof raw === 'string' && new TextEncoder().encode(raw).byteLength <= MAX_ENVELOPE_BYTES, 'relay_envelope_too_large', 413);
    let parsed;
    try { parsed = JSON.parse(raw); } catch { throw new RelayV31Error('relay_json_invalid'); }
    if (parsed?.contract === KEY_QUERY_CONTRACT) return handleKeyQuery(parsed, env);
    if (parsed?.contract === DELIVERY_ACK_CONTRACT) return handleDeliveryAck(parsed, env, fetchImpl);
    if (parsed?.contract === REPLY_REFRESH_CONTRACT) return handleReplyRefresh(parsed, env, fetchImpl);

    const envelope = parseCanonicalEnvelopeV31(raw);
    const result = await acceptEnvelope(envelope, env, fetchImpl);
    let replyEnvelope = null;
    if (envelope.ordering.relation.type === 'root'
      && envelope.source.member === 'founder-control-room'
      && envelope.target.member === 'chief-ai-machine') {
      replyEnvelope = await reserveReply(envelope, result, env, fetchImpl);
    }
    return Response.json({
      contract: RELAY_CONTRACT,
      ...result,
      ...(replyEnvelope ? { replyEnvelope, replyDelivery: 'pending' } : {}),
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    }, { status: result.delivery === 'accepted' ? 201 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof RelayV31Error;
    return Response.json({
      ok: false,
      error: known ? error.code : 'relay_internal_error',
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    }, { status: known ? error.status : 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
