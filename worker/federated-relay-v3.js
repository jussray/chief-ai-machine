import {
  FEDERATED_AGENT_RELAY_V3,
  FederatedRelayV3Error,
  canonicalizeRelayJsonV3,
  parseFederatedAgentRelayEnvelopeV3,
  sha256HexV3,
  signRelayEnvelopeV3,
  verifyRelayEnvelopeV3,
} from './federated-relay-v3-core.js';

const DEFAULT_KEY_VALID_FROM = '2026-09-13T00:00:00.000Z';
const FCR_RELAY_PROJECT_URL = 'https://oojzfmmywbvficgybaxd.supabase.co';
const CHIEF_MEMBER = 'chief-ai-machine';
const CHIEF_REPOSITORY = 'jussray/chief-ai-machine';

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function requiredEnv(env, name) {
  const value = typeof env?.[name] === 'string' ? env[name].trim() : '';
  if (!value) throw new FederatedRelayV3Error(`relay_config_${name.toLowerCase()}_missing`);
  return value;
}

function relayDatabaseError(message) {
  const text = typeof message === 'string' ? message : JSON.stringify(message);
  const match = text.match(/relay_[a-z0-9_]+/i);
  return new FederatedRelayV3Error(match?.[0] ?? 'relay_database_error', text.slice(0, 1000));
}

function statusFor(error) {
  if (error.code?.includes('_missing') || error.code === 'relay_runtime_identity_unavailable') return 503;
  if (error.code === 'relay_signing_key_unknown' || error.code === 'relay_signature_invalid' || error.code === 'relay_signing_key_revoked') return 401;
  if (error.code === 'relay_target_identity_stale' || error.code === 'relay_expired' || error.code === 'relay_issued_in_future') return 409;
  if (/sequence|nonce|collision|chain_|supersession|reply_/.test(error.code ?? '')) return 409;
  if (error.code === 'relay_database_error') return 503;
  return 400;
}

function supabaseUrl(env) {
  const configured = typeof env?.FCR_RELAY_SUPABASE_URL === 'string' && env.FCR_RELAY_SUPABASE_URL.trim()
    ? env.FCR_RELAY_SUPABASE_URL.trim().replace(/\/$/, '')
    : FCR_RELAY_PROJECT_URL;
  if (configured !== FCR_RELAY_PROJECT_URL) throw new FederatedRelayV3Error('relay_config_supabase_identity_mismatch');
  return configured;
}

/**
 * @param {Record<string, unknown>} env
 * @param {string} path
 * @param {{ method?: string, body?: unknown, prefer?: string }} [options]
 */
async function dbRequest(env, path, options = {}) {
  const { method = 'GET', body, prefer } = options;
  const secret = requiredEnv(env, 'FCR_RELAY_SUPABASE_SECRET_KEY');
  const headers = {
    apikey: secret,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  };
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(`${supabaseUrl(env)}/rest/v1/${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = raw; }
  }
  if (!response.ok) throw relayDatabaseError(data?.message ?? data ?? `Supabase ${response.status}`);
  return data;
}

function parsePrivateJwk(env) {
  const raw = requiredEnv(env, 'CHIEF_FEDERATED_RELAY_PRIVATE_JWK');
  let jwk;
  try { jwk = JSON.parse(raw); } catch { throw new FederatedRelayV3Error('relay_private_key_json_invalid'); }
  if (!jwk || jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.d !== 'string' || typeof jwk.x !== 'string') {
    throw new FederatedRelayV3Error('relay_private_key_invalid');
  }
  return jwk;
}

function publicJwkFromPrivate(privateJwk) {
  return { kty: 'OKP', crv: 'Ed25519', x: privateJwk.x };
}

async function loadPublicKey(env, keyId) {
  const encoded = encodeURIComponent(keyId);
  const rows = await dbRequest(
    env,
    `federated_relay_public_keys?select=member,key_id,algorithm,public_key_jwk,state,valid_from,valid_until,revoked_at&key_id=eq.${encoded}&limit=1`,
  );
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) throw new FederatedRelayV3Error('relay_signing_key_unknown');
  if (row.algorithm !== 'Ed25519') throw new FederatedRelayV3Error('relay_signature_algorithm_rejected');
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

async function ensureChiefPublicKey(env) {
  const keyId = requiredEnv(env, 'CHIEF_FEDERATED_RELAY_KEY_ID');
  const privateJwk = parsePrivateJwk(env);
  const publicKeyJwk = publicJwkFromPrivate(privateJwk);
  let existing = null;
  try { existing = await loadPublicKey(env, keyId); } catch (error) {
    if (!(error instanceof FederatedRelayV3Error) || error.code !== 'relay_signing_key_unknown') throw error;
  }
  if (existing) {
    if (existing.member !== CHIEF_MEMBER || canonicalizeRelayJsonV3(existing.publicKeyJwk) !== canonicalizeRelayJsonV3(publicKeyJwk)) {
      throw new FederatedRelayV3Error('relay_key_id_collision');
    }
    return { keyId, privateJwk, publicKeyJwk };
  }

  const validFrom = typeof env?.CHIEF_FEDERATED_RELAY_KEY_VALID_FROM === 'string' && env.CHIEF_FEDERATED_RELAY_KEY_VALID_FROM.trim()
    ? env.CHIEF_FEDERATED_RELAY_KEY_VALID_FROM.trim()
    : DEFAULT_KEY_VALID_FROM;
  try {
    await dbRequest(env, 'federated_relay_public_keys', {
      method: 'POST',
      prefer: 'return=minimal',
      body: {
        member: CHIEF_MEMBER,
        key_id: keyId,
        algorithm: 'Ed25519',
        public_key_jwk: publicKeyJwk,
        state: 'active',
        valid_from: validFrom,
      },
    });
  } catch (error) {
    // A simultaneous cold start may have inserted the same identity. Re-read
    // and accept only an exact public-key match.
    const raced = await loadPublicKey(env, keyId);
    if (raced.member !== CHIEF_MEMBER || canonicalizeRelayJsonV3(raced.publicKeyJwk) !== canonicalizeRelayJsonV3(publicKeyJwk)) throw error;
  }
  return { keyId, privateJwk, publicKeyJwk };
}

async function findStoredMessage(env, messageId) {
  const encoded = encodeURIComponent(messageId);
  const rows = await dbRequest(
    env,
    `federated_relay_messages?select=message_fingerprint,receipt&message_id=eq.${encoded}&limit=1`,
  );
  return Array.isArray(rows) ? rows[0] ?? null : null;
}

function validStoredReceipt(value) {
  return Boolean(value)
    && value.contract === FEDERATED_AGENT_RELAY_V3
    && value.executionAuthorized === false
    && value.authorityTransferred === false
    && value.approvalCarriedForward === false
    && typeof value.successorProofCookie === 'string';
}

async function persistVerified(env, verified) {
  const envelope = verified.envelope;
  const rows = await dbRequest(env, 'rpc/federated_relay_accept_v3', {
    method: 'POST',
    body: {
      p_contract: envelope.contract,
      p_message_id: envelope.messageId,
      p_message_fingerprint: verified.messageFingerprint,
      p_chain_id: envelope.ordering.chainId,
      p_chain_position: envelope.ordering.chainPosition,
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
      p_predecessor_message_id: envelope.ordering.predecessorMessageId ?? null,
      p_reply_to_message_id: envelope.replyToMessageId ?? null,
      p_predecessor_proof_cookie: envelope.predecessorProofCookie,
      p_successor_proof_cookie: verified.successorProofCookie,
      p_payload_sha256: envelope.payload.sha256,
      p_evidence_digest: verified.evidenceDigest,
      p_issued_at: envelope.issuedAt,
      p_expires_at: envelope.expiresAt,
      p_envelope: envelope,
      p_receipt: verified.receipt,
      p_supersedes_message_ids: envelope.supersedesMessageIds,
    },
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || !['accepted', 'duplicate'].includes(row.outcome) || !validStoredReceipt(row.stored_receipt)) {
    throw new FederatedRelayV3Error('relay_database_result_invalid');
  }
  return { outcome: row.outcome, receipt: row.stored_receipt };
}

async function reserveReply(env, parentMessageId, keyId) {
  const rows = await dbRequest(env, 'rpc/federated_relay_reserve_reply_v3', {
    method: 'POST',
    body: {
      p_parent_message_id: parentMessageId,
      p_source_member: CHIEF_MEMBER,
      p_source_key_id: keyId,
    },
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row || !Number.isSafeInteger(Number(row.source_sequence)) || typeof row.reply_message_id !== 'string' || typeof row.reply_nonce !== 'string' || typeof row.reserved_at !== 'string') {
    throw new FederatedRelayV3Error('relay_reply_reservation_invalid');
  }
  return {
    sourceSequence: Number(row.source_sequence),
    messageId: row.reply_message_id,
    nonce: row.reply_nonce,
    reservedAt: row.reserved_at,
  };
}

async function buildSignedReply(env, runtimeSha, parent, parentFingerprint, parentReceipt) {
  const chiefKey = await ensureChiefPublicKey(env);
  const reservation = await reserveReply(env, parent.messageId, chiefKey.keyId);
  const issuedAt = new Date(reservation.reservedAt);
  if (Number.isNaN(issuedAt.getTime())) throw new FederatedRelayV3Error('relay_reply_reservation_invalid');
  const expiresAt = new Date(issuedAt.getTime() + 5 * 60_000);
  const body = 'Chief accepted this signed relay as evidence-only continuity. No execution authority, founder approval, merge authority, deploy authority, or provider-mutation authority transferred.';
  const evidence = [
    ...parent.evidence,
    {
      ref: `github://jussray/chief-ai-machine@${runtimeSha}`,
      state: 'verified',
    },
  ];
  const unsignedReply = {
    contract: FEDERATED_AGENT_RELAY_V3,
    messageId: reservation.messageId,
    replyToMessageId: parent.messageId,
    ordering: {
      chainId: parent.ordering.chainId,
      sourceSequence: reservation.sourceSequence,
      chainPosition: parent.ordering.chainPosition + 1,
      logicalOperationId: parent.ordering.logicalOperationId,
      predecessorMessageId: parent.messageId,
    },
    source: {
      member: CHIEF_MEMBER,
      repository: CHIEF_REPOSITORY,
      branch: 'main',
      headSha: runtimeSha,
    },
    target: { ...parent.source },
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    nonce: reservation.nonce,
    disposition: 'observe',
    subject: `Chief evidence receipt: ${parent.subject}`.slice(0, 500),
    payload: {
      contentType: 'text/plain',
      body,
      sha256: await sha256HexV3(body),
    },
    contextFingerprint: parentFingerprint,
    predecessorProofCookie: parentReceipt.successorProofCookie,
    evidence: evidence.slice(0, 20),
    supersedesMessageIds: [],
  };
  return signRelayEnvelopeV3(unsignedReply, chiefKey.privateJwk, chiefKey.keyId);
}

export async function handleFederatedRelayV3(request, env, runtimeSha) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > 65536) return json({ error: 'Relay envelope exceeds 64KB.' }, 413);

  try {
    const normalizedRuntimeSha = typeof runtimeSha === 'string' ? runtimeSha.trim().toLowerCase() : '';
    if (!/^[0-9a-f]{40}$/.test(normalizedRuntimeSha)) throw new FederatedRelayV3Error('relay_runtime_identity_unavailable');
    let input;
    try { input = await request.json(); } catch { throw new FederatedRelayV3Error('relay_envelope_json_invalid'); }
    const envelope = parseFederatedAgentRelayEnvelopeV3(input);
    if (
      envelope.target.member !== CHIEF_MEMBER
      || envelope.target.repository !== CHIEF_REPOSITORY
      || envelope.target.branch !== 'main'
      || envelope.target.headSha !== normalizedRuntimeSha
    ) {
      throw new FederatedRelayV3Error('relay_target_identity_stale');
    }

    const incomingFingerprint = await sha256HexV3(canonicalizeRelayJsonV3(envelope));
    const stored = await findStoredMessage(env, envelope.messageId);
    let durable;
    if (stored) {
      if (stored.message_fingerprint !== incomingFingerprint) throw new FederatedRelayV3Error('relay_message_id_collision');
      if (!validStoredReceipt(stored.receipt)) throw new FederatedRelayV3Error('relay_stored_receipt_invalid');
      durable = { outcome: 'duplicate', receipt: stored.receipt };
    } else {
      const sourceKey = await loadPublicKey(env, envelope.signature.keyId);
      const verified = await verifyRelayEnvelopeV3({
        envelope,
        key: sourceKey,
        expectedTarget: {
          member: CHIEF_MEMBER,
          repository: CHIEF_REPOSITORY,
          branch: 'main',
          headSha: normalizedRuntimeSha,
        },
      });
      durable = await persistVerified(env, verified);
    }

    const replyEnvelope = await buildSignedReply(
      env,
      normalizedRuntimeSha,
      envelope,
      incomingFingerprint,
      durable.receipt,
    );

    return json({
      contract: FEDERATED_AGENT_RELAY_V3,
      status: durable.outcome,
      receipt: durable.receipt,
      replyEnvelope,
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    }, durable.outcome === 'accepted' ? 201 : 200);
  } catch (error) {
    const relayError = error instanceof FederatedRelayV3Error
      ? error
      : new FederatedRelayV3Error('relay_internal_error', error instanceof Error ? error.message : String(error));
    return json({
      error: relayError.code,
      detail: relayError.message,
      executionAuthorized: false,
      authorityTransferred: false,
      approvalCarriedForward: false,
    }, statusFor(relayError));
  }
}
