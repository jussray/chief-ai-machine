import { RelayV31Error } from './federated-relay-v31.js';
import { handleFederatedRelayV31Transport, readBoundedRelayBodyV31 } from './federated-relay-v31-transport.js';

const KEY_QUERY_CONTRACT = 'juss/federated-agent-relay-key-query@v3.1';
const DELIVERY_ACK_CONTRACT = 'juss/federated-agent-relay-delivery-ack@v3.1';
const REPLY_REFRESH_CONTRACT = 'juss/federated-agent-relay-reply-refresh@v3.1';
const RELAY_CONTRACT = 'juss/federated-agent-relay@v3.1';
const SOURCE_ORIGIN_HEADER = 'x-federated-relay-source-origin';
const SHA40 = /^[0-9a-f]{40}$/;
const FCR_REPOSITORY = 'jussray/founder-control-room';
const FCR_WORKER_HOST = /^[a-z0-9-]+-founder-control-room\.mcgill-raylene\.workers\.dev$/;

function relayAssert(condition, code, status = 400) {
  if (!condition) throw new RelayV31Error(code, status);
}
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
async function supabaseRequest(env, path, init, fetchImpl) {
  relayAssert(typeof env.RELAY_SUPABASE_URL === 'string' && typeof env.RELAY_SUPABASE_SERVICE_ROLE_KEY === 'string', 'relay_ledger_unconfigured', 503);
  const response = await fetchImpl(`${env.RELAY_SUPABASE_URL.replace(/\/$/u, '')}${path}`, {
    ...init,
    headers: {
      apikey: env.RELAY_SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.RELAY_SUPABASE_SERVICE_ROLE_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const text = await response.text();
  let data = null;
  if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!response.ok) throw new RelayV31Error(typeof data?.message === 'string' ? data.message : 'relay_database_error', response.status >= 500 ? 503 : 409);
  return data;
}
async function supabaseGet(env, path, fetchImpl) {
  return supabaseRequest(env, path, { method: 'GET' }, fetchImpl);
}
async function maybeLoadRelayKey(env, member, keyId, fetchImpl) {
  relayAssert(typeof member === 'string' && typeof keyId === 'string', 'relay_key_query_invalid', 400);
  const select = 'member,key_id,public_key_jwk,state,valid_from,valid_until,revoked_at';
  const data = await supabaseGet(
    env,
    `/rest/v1/federated_relay_v31_public_keys?member=eq.${encodeURIComponent(member)}&key_id=eq.${encodeURIComponent(keyId)}&select=${encodeURIComponent(select)}&limit=1`,
    fetchImpl,
  );
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
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
async function loadRelayKey(env, member, keyId, fetchImpl) {
  const key = await maybeLoadRelayKey(env, member, keyId, fetchImpl);
  relayAssert(key, 'relay_key_unknown', 401);
  return key;
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
function exactFcrOrigin(request) {
  const raw = String(request.headers.get(SOURCE_ORIGIN_HEADER) || '').trim();
  relayAssert(raw, 'relay_source_origin_required', 401);
  let parsed;
  try { parsed = new URL(raw); } catch { throw new RelayV31Error('relay_source_origin_invalid', 401); }
  relayAssert(parsed.protocol === 'https:' && !parsed.username && !parsed.password, 'relay_source_origin_invalid', 401);
  relayAssert(parsed.pathname === '/' && !parsed.search && !parsed.hash, 'relay_source_origin_invalid', 401);
  const host = parsed.hostname.toLowerCase();
  const allowed = host === 'api.foundercontrolroom.org'
    || host.endsWith('.foundercontrolroom.org')
    || FCR_WORKER_HOST.test(host);
  relayAssert(allowed, 'relay_source_origin_not_allowed', 401);
  return parsed.origin;
}
async function bootstrapFcrKey(request, envelope, env, fetchImpl) {
  relayAssert(envelope?.source?.member === 'founder-control-room'
    && envelope.source.repository === FCR_REPOSITORY
    && typeof envelope.source.headSha === 'string'
    && SHA40.test(envelope.source.headSha)
    && typeof envelope.signature?.keyId === 'string', 'relay_source_bootstrap_invalid', 401);
  const origin = exactFcrOrigin(request);

  const versionResponse = await fetchImpl(`${origin}/version`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'manual',
  });
  relayAssert(versionResponse.ok, 'relay_source_runtime_identity_unavailable', 503);
  const version = await versionResponse.json();
  const observedSha = String(version?.gitSha || version?.sha || '').trim().toLowerCase();
  relayAssert(observedSha === envelope.source.headSha, 'relay_source_runtime_identity_stale', 409);

  const keyResponse = await fetchImpl(`${origin}/api/federated-relay/v3`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contract: KEY_QUERY_CONTRACT,
      member: 'founder-control-room',
      keyId: envelope.signature.keyId,
    }),
    redirect: 'manual',
  });
  relayAssert(keyResponse.ok, 'relay_source_key_query_failed', 503);
  const keyResult = await keyResponse.json();
  relayAssert(keyResult?.contract === KEY_QUERY_CONTRACT
    && keyResult.executionAuthorized === false
    && keyResult.authorityTransferred === false
    && keyResult.approvalCarriedForward === false,
  'relay_source_key_query_invalid', 503);
  const key = keyResult.key;
  relayAssert(key?.member === 'founder-control-room'
    && key.keyId === envelope.signature.keyId
    && key.publicKeyJwk?.kty === 'OKP'
    && key.publicKeyJwk?.crv === 'Ed25519'
    && typeof key.publicKeyJwk?.x === 'string'
    && (key.state === 'active' || key.state === 'retiring')
    && typeof key.validFrom === 'string'
    && !key.revokedAt,
  'relay_source_key_query_invalid', 503);

  await supabaseRequest(env, '/rest/v1/rpc/federated_relay_v31_register_observed_key', {
    method: 'POST',
    body: JSON.stringify({
      p_member: key.member,
      p_key_id: key.keyId,
      p_public_key_jwk: key.publicKeyJwk,
      p_state: key.state,
      p_valid_from: key.validFrom,
      p_valid_until: key.validUntil ?? null,
    }),
  }, fetchImpl);
  return key;
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
function githubBranchUrl(source) {
  return `https://api.github.com/repos/${source.repository}/branches/${encodeURIComponent(source.branch)}`;
}
function githubHeaders() {
  return { Accept: 'application/vnd.github+json', 'User-Agent': 'chief-federated-relay-v31' };
}
async function readGitHubJson(response, unavailableCode) {
  relayAssert(response.ok, unavailableCode, response.status === 404 ? 409 : 503);
  try {
    return await response.json();
  } catch {
    throw new RelayV31Error(unavailableCode, 503);
  }
}
export async function verifySourceCommitReachabilityV31(source, fetchImpl = fetch) {
  relayAssert(isRecord(source) && typeof source.repository === 'string' && typeof source.branch === 'string'
    && typeof source.headSha === 'string' && SHA40.test(source.headSha), 'relay_source_identity_invalid', 400);
  const branchResponse = await fetchImpl(githubBranchUrl(source), { headers: githubHeaders() });
  const branch = await readGitHubJson(
    branchResponse,
    branchResponse.status === 404 ? 'relay_source_branch_unknown' : 'relay_source_provider_unavailable',
  );
  const branchHead = String(branch?.commit?.sha ?? '').toLowerCase();
  relayAssert(SHA40.test(branchHead), 'relay_source_provider_invalid', 503);
  if (branchHead === source.headSha) return { branchHead, state: 'current_head_at_acceptance' };

  const commitResponse = await fetchImpl(
    `https://api.github.com/repos/${source.repository}/commits/${source.headSha}`,
    { headers: githubHeaders() },
  );
  if (commitResponse.status === 404) throw new RelayV31Error('relay_source_commit_missing', 409);
  relayAssert(commitResponse.ok, 'relay_source_provider_unavailable', 503);

  const compareResponse = await fetchImpl(
    `https://api.github.com/repos/${source.repository}/compare/${source.headSha}...${branchHead}`,
    { headers: githubHeaders() },
  );
  if (compareResponse.status === 404) throw new RelayV31Error('relay_source_history_unreachable', 409);
  const comparison = await readGitHubJson(compareResponse, 'relay_source_provider_unavailable');
  relayAssert(comparison?.status === 'ahead' || comparison?.status === 'identical', 'relay_source_history_unreachable', 409);
  return { branchHead, state: 'reachable_at_acceptance' };
}
export function sourceReachabilityFetchV31(fetchImpl, source) {
  const verifiedBranchUrl = githubBranchUrl(source);
  return async (input, init = {}) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === verifiedBranchUrl) {
      return Response.json({ commit: { sha: source.headSha } }, { status: 200 });
    }
    return fetchImpl(input, init);
  };
}
function historicalChiefKeyResponse(key) {
  relayAssert((key.state === 'active' || key.state === 'retiring') && !key.revokedAt, 'relay_key_not_servable', 404);
  return Response.json({
    contract: KEY_QUERY_CONTRACT,
    key,
    executionAuthorized: false,
    authorityTransferred: false,
    approvalCarriedForward: false,
  }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

export async function handleFederatedRelayV31Runtime(request, env, fetchImpl = fetch) {
  if (request.method !== 'POST') return await handleFederatedRelayV31Transport(request, env, fetchImpl);
  try {
    const raw = await readBoundedRelayBodyV31(request);
    let body;
    try { body = JSON.parse(raw); } catch { return await handleFederatedRelayV31Transport(request, env, fetchImpl, raw); }

    if (body?.contract === KEY_QUERY_CONTRACT) {
      relayAssert(body.member === 'chief-ai-machine' && typeof body.keyId === 'string', 'relay_key_query_invalid', 400);
      const historicalKey = await maybeLoadRelayKey(env, 'chief-ai-machine', body.keyId, fetchImpl);
      if (historicalKey) return historicalChiefKeyResponse(historicalKey);
      return await handleFederatedRelayV31Transport(request, env, fetchImpl, raw);
    }

    if (body?.contract === DELIVERY_ACK_CONTRACT) {
      relayAssert(typeof body.messageId === 'string' && isRecord(body.receipt) && typeof body.receipt.signature?.keyId === 'string', 'relay_delivery_ack_invalid');
      const [outbox, receiptKey] = await Promise.all([
        loadOutbox(env, body.messageId, fetchImpl),
        loadRelayKey(env, 'founder-control-room', body.receipt.signature.keyId, fetchImpl),
      ]);
      assertReceiptBindsOutbox(body.receipt, outbox);
      return await handleFederatedRelayV31Transport(request, mergeRegistry(env, [receiptKey]), fetchImpl, raw);
    }

    if (body?.contract === REPLY_REFRESH_CONTRACT) {
      relayAssert(typeof body.signature?.keyId === 'string', 'relay_reply_refresh_signature_invalid', 401);
      const refreshKey = await loadRelayKey(env, 'founder-control-room', body.signature.keyId, fetchImpl);
      return await handleFederatedRelayV31Transport(request, mergeRegistry(env, [refreshKey]), fetchImpl, raw);
    }

    if (body?.contract === RELAY_CONTRACT) {
      relayAssert(typeof body.source?.member === 'string' && typeof body.signature?.keyId === 'string', 'relay_signature_invalid');
      let sourceKey = await maybeLoadRelayKey(env, body.source.member, body.signature.keyId, fetchImpl);
      if (!sourceKey && body.source.member === 'founder-control-room') {
        sourceKey = await bootstrapFcrKey(request, body, env, fetchImpl);
      }
      relayAssert(sourceKey, 'relay_key_unknown', 401);
      await verifySourceCommitReachabilityV31(body.source, fetchImpl);
      const verifiedFetch = sourceReachabilityFetchV31(fetchImpl, body.source);
      return await handleFederatedRelayV31Transport(request, mergeRegistry(env, [sourceKey]), verifiedFetch, raw);
    }

    return await handleFederatedRelayV31Transport(request, env, fetchImpl, raw);
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
