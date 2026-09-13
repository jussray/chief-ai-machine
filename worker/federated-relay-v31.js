const CONTRACT = 'juss/federated-agent-relay@v3.1';
const RECEIPT_CONTRACT = 'juss/federated-agent-relay-receipt@v3.1';
const GENESIS_COOKIE = 'Q4R:v3.1:genesis';
const MAX_ENVELOPE_BYTES = 512 * 1024;
const MAX_PAYLOAD_BYTES = 256 * 1024;
const MAX_TTL_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 30 * 1000;
const MEMBERS = {
  'founder-control-room': 'jussray/founder-control-room',
  'chief-ai-machine': 'jussray/chief-ai-machine',
  solcontinuity: 'jussray/solcontinuity',
  promptos: 'jussray/promptos',
};
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA40_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export class RelayV31Error extends Error {
  constructor(code, status = 400) {
    super(code);
    this.name = 'RelayV31Error';
    this.code = code;
    this.status = status;
  }
}

function assert(condition, code, status = 400) {
  if (!condition) throw new RelayV31Error(code, status);
}
function plain(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}
function exactKeys(value, allowed, code) {
  assert(plain(value), code);
  const set = new Set(allowed);
  assert(Object.keys(value).every((key) => set.has(key)), `${code}_field`);
}
function noLoneSurrogates(value) {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return false;
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) return false;
  }
  return true;
}
export function canonicalizeRelayJcsV31(value, depth = 0) {
  assert(depth <= 64, 'relay_jcs_depth');
  if (value === null) return 'null';
  if (typeof value === 'string') {
    assert(noLoneSurrogates(value), 'relay_jcs_lone_surrogate');
    return JSON.stringify(value);
  }
  if (typeof value === 'number') {
    assert(Number.isFinite(value), 'relay_jcs_nonfinite');
    return JSON.stringify(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  assert(typeof value !== 'undefined', 'relay_jcs_undefined');
  if (Array.isArray(value)) return `[${value.map((item) => canonicalizeRelayJcsV31(item, depth + 1)).join(',')}]`;
  assert(plain(value), 'relay_jcs_nonplain_object');
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => {
    assert(typeof value[key] !== 'undefined', 'relay_jcs_undefined_prop');
    return `${canonicalizeRelayJcsV31(key, depth + 1)}:${canonicalizeRelayJcsV31(value[key], depth + 1)}`;
  }).join(',')}}`;
}

async function sha256Bytes(bytes) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
}
function hex(bytes) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(''); }
export async function sha256HexV31(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return hex(await sha256Bytes(bytes));
}
async function taggedDigest(tag, parts) {
  const encoder = new TextEncoder();
  const chunks = [tag, '\u0000'];
  for (const part of parts) {
    const length = encoder.encode(part).byteLength;
    chunks.push(String(length), '\u0000', part, '\u0000');
  }
  return sha256HexV31(chunks.join(''));
}
function unsignedEnvelope(envelope) { const { signature: _signature, ...unsigned } = envelope; return unsigned; }
export async function semanticFingerprintV31(envelope) { return sha256HexV31(canonicalizeRelayJcsV31(unsignedEnvelope(envelope))); }
export async function deliveryFingerprintV31(envelope) { return sha256HexV31(canonicalizeRelayJcsV31(envelope)); }
async function evidenceDigestV31(evidence) { return taggedDigest('juss.federated-relay.evidence.v3.1', [canonicalizeRelayJcsV31(evidence)]); }
async function successorCookieV31(envelope, deliveryFingerprint) {
  const digest = await taggedDigest('juss.federated-relay.cookie.v3.1', [envelope.ordering.chainId, envelope.predecessorProofCookie, deliveryFingerprint, envelope.nonce, envelope.source.member, envelope.target.member]);
  return `Q4R:v3.1:${digest}`;
}
function decodeBase64Url64(value) {
  assert(typeof value === 'string' && value.length === 86 && BASE64URL_RE.test(value), 'relay_signature_base64url_invalid', 401);
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(`${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  assert(bytes.byteLength === 64, 'relay_signature_length_invalid', 401);
  let canonical = btoa(String.fromCharCode(...bytes)).replace(/=+$/u, '').replace(/\+/g, '-').replace(/\//g, '_');
  assert(canonical === value, 'relay_signature_base64url_noncanonical', 401);
  return bytes;
}
function encodeBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/u, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function boundedJson(body, maxDepth = 32) {
  let parsed;
  try { parsed = JSON.parse(body); } catch { throw new RelayV31Error('relay_payload_not_json'); }
  const stack = [{ value: parsed, depth: 0 }];
  while (stack.length) {
    const current = stack.pop();
    assert(current.depth <= maxDepth, 'relay_payload_json_depth');
    if (current.value === null || typeof current.value !== 'object') continue;
    const values = Array.isArray(current.value) ? current.value : Object.values(current.value);
    for (const child of values) stack.push({ value: child, depth: current.depth + 1 });
  }
  return parsed;
}
function memberIdentity(value, code) {
  exactKeys(value, ['member', 'repository', 'branch', 'headSha'], code);
  assert(typeof value.member === 'string' && MEMBERS[value.member], `${code}_member`);
  assert(value.repository === MEMBERS[value.member], `${code}_repository`);
  assert(typeof value.branch === 'string' && value.branch.length > 0 && value.branch.length <= 120 && !/[\u0000\r\n]/u.test(value.branch), `${code}_branch`);
  assert(typeof value.headSha === 'string' && SHA40_RE.test(value.headSha), `${code}_head_sha`);
}
export function assertEnvelopeV31(envelope) {
  exactKeys(envelope, ['contract','messageId','replyToMessageId','ordering','source','target','issuedAt','expiresAt','nonce','disposition','subject','payload','contextFingerprint','predecessorProofCookie','evidence','supersedesMessageIds','signature'], 'relay');
  assert(envelope.contract === CONTRACT, 'relay_contract');
  assert(UUID_RE.test(envelope.messageId || ''), 'relay_message_id');
  if (envelope.replyToMessageId !== undefined) assert(UUID_RE.test(envelope.replyToMessageId), 'relay_reply_to_message_id');
  assert(UUID_RE.test(envelope.nonce || ''), 'relay_nonce');
  exactKeys(envelope.ordering, ['chainId','sourceSequence','chainPosition','logicalOperationId','relation'], 'relay_ordering');
  assert(UUID_RE.test(envelope.ordering.chainId || ''), 'relay_chain_id');
  assert(UUID_RE.test(envelope.ordering.logicalOperationId || ''), 'relay_logical_operation_id');
  assert(Number.isSafeInteger(envelope.ordering.sourceSequence) && envelope.ordering.sourceSequence >= 0, 'relay_source_sequence');
  assert(Number.isSafeInteger(envelope.ordering.chainPosition) && envelope.ordering.chainPosition >= 0, 'relay_chain_position');
  assert(plain(envelope.ordering.relation) && ['root','reply','revision','reconcile'].includes(envelope.ordering.relation.type), 'relay_relation_type');
  if (envelope.ordering.relation.type === 'root') {
    exactKeys(envelope.ordering.relation, ['type'], 'relay_root_relation');
    assert(envelope.ordering.chainPosition === 0 && envelope.replyToMessageId === undefined && envelope.predecessorProofCookie === GENESIS_COOKIE, 'relay_root_invalid');
  } else {
    exactKeys(envelope.ordering.relation, ['type','parentMessageId'], 'relay_relation');
    assert(UUID_RE.test(envelope.ordering.relation.parentMessageId || ''), 'relay_parent_message_id');
    assert(envelope.ordering.chainPosition > 0, 'relay_nonroot_chain_position');
    if (envelope.ordering.relation.type === 'reply') assert(envelope.replyToMessageId === envelope.ordering.relation.parentMessageId, 'relay_reply_parent_mismatch');
    else assert(envelope.replyToMessageId === undefined, 'relay_nonreply_reply_to');
  }
  memberIdentity(envelope.source, 'relay_source'); memberIdentity(envelope.target, 'relay_target');
  assert(envelope.source.member !== envelope.target.member, 'relay_self_target');
  assert(['observe','reconcile','propose'].includes(envelope.disposition), 'relay_disposition');
  assert(typeof envelope.subject === 'string' && envelope.subject.length > 0 && envelope.subject.length <= 512, 'relay_subject');
  exactKeys(envelope.payload, ['contentType','body','sha256'], 'relay_payload');
  assert(['text/plain','application/json'].includes(envelope.payload.contentType), 'relay_payload_type');
  assert(typeof envelope.payload.body === 'string' && new TextEncoder().encode(envelope.payload.body).byteLength <= MAX_PAYLOAD_BYTES, 'relay_payload_body');
  assert(SHA256_RE.test(envelope.payload.sha256 || ''), 'relay_payload_sha');
  if (envelope.payload.contentType === 'application/json') boundedJson(envelope.payload.body);
  assert(SHA256_RE.test(envelope.contextFingerprint || ''), 'relay_context_fingerprint');
  assert(typeof envelope.predecessorProofCookie === 'string' && envelope.predecessorProofCookie.length > 0 && envelope.predecessorProofCookie.length <= 300, 'relay_predecessor_cookie');
  assert(Array.isArray(envelope.evidence) && envelope.evidence.length <= 64, 'relay_evidence');
  for (const item of envelope.evidence) {
    exactKeys(item, ['locator','state','sha256','proofReceiptId'], 'relay_evidence');
    exactKeys(item.locator, ['provider','ref'], 'relay_evidence_locator');
    assert(['github','cloudflare','supabase','juss-proof'].includes(item.locator.provider), 'relay_evidence_provider');
    assert(typeof item.locator.ref === 'string' && item.locator.ref.length > 0 && item.locator.ref.length <= 2000, 'relay_evidence_ref');
    assert(['verified','inferred','unknown','stale','blocked','failed'].includes(item.state), 'relay_evidence_state');
    if (item.sha256 !== undefined) assert(SHA256_RE.test(item.sha256), 'relay_evidence_sha');
    if (item.proofReceiptId !== undefined) assert(typeof item.proofReceiptId === 'string' && item.proofReceiptId.length <= 300, 'relay_evidence_receipt_id');
  }
  assert(Array.isArray(envelope.supersedesMessageIds) && envelope.supersedesMessageIds.length <= 64, 'relay_supersedes');
  const supersedes = new Set();
  for (const id of envelope.supersedesMessageIds) { assert(UUID_RE.test(id), 'relay_supersedes_message_id'); assert(id !== envelope.messageId && !supersedes.has(id), 'relay_supersession_invalid'); supersedes.add(id); }
  if (envelope.ordering.relation.type === 'revision') assert(envelope.supersedesMessageIds.length > 0, 'relay_revision_without_supersession');
  else assert(envelope.supersedesMessageIds.length === 0, 'relay_supersession_requires_revision');
  exactKeys(envelope.signature, ['algorithm','keyId','valueBase64Url'], 'relay_signature');
  assert(envelope.signature.algorithm === 'Ed25519', 'relay_signature_algorithm');
  assert(typeof envelope.signature.keyId === 'string' && envelope.signature.keyId.length > 0 && envelope.signature.keyId.length <= 200, 'relay_signature_key_id');
  decodeBase64Url64(envelope.signature.valueBase64Url);
}
export function parseCanonicalEnvelopeV31(raw) {
  assert(new TextEncoder().encode(raw).byteLength <= MAX_ENVELOPE_BYTES, 'relay_envelope_too_large', 413);
  let envelope; try { envelope = JSON.parse(raw); } catch { throw new RelayV31Error('relay_json_invalid'); }
  assert(raw === canonicalizeRelayJcsV31(envelope), 'relay_transport_not_canonical_jcs');
  assertEnvelopeV31(envelope); return envelope;
}
function validateFreshness(envelope, now = Date.now()) {
  const issued = Date.parse(envelope.issuedAt); const expires = Date.parse(envelope.expiresAt);
  assert(Number.isFinite(issued) && new Date(issued).toISOString() === envelope.issuedAt, 'relay_issued_at');
  assert(Number.isFinite(expires) && new Date(expires).toISOString() === envelope.expiresAt, 'relay_expires_at');
  assert(expires > issued && expires - issued <= MAX_TTL_MS, 'relay_invalid_expiry');
  assert(issued <= now + CLOCK_SKEW_MS, 'relay_issued_in_future'); assert(now <= expires, 'relay_expired');
}
async function readBoundedBody(request) {
  if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > MAX_ENVELOPE_BYTES) throw new RelayV31Error('relay_envelope_too_large', 413);
  if (!request.body) return '';
  const reader = request.body.getReader(); const chunks = []; let total = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; total += value.byteLength; if (total > MAX_ENVELOPE_BYTES) { await reader.cancel(); throw new RelayV31Error('relay_envelope_too_large', 413); } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new RelayV31Error('relay_utf8_invalid'); }
}
function parseRegistry(env) {
  assert(typeof env.FEDERATED_RELAY_PUBLIC_KEYS_JSON === 'string', 'relay_key_registry_unconfigured', 503);
  let keys; try { keys = JSON.parse(env.FEDERATED_RELAY_PUBLIC_KEYS_JSON); } catch { throw new RelayV31Error('relay_key_registry_invalid', 503); }
  assert(Array.isArray(keys), 'relay_key_registry_invalid', 503); return keys;
}
async function verifySignature(envelope, env) {
  const key = parseRegistry(env).find((candidate) => candidate.member === envelope.source.member && candidate.keyId === envelope.signature.keyId);
  assert(key, 'relay_key_unknown', 401); assert(['active','retiring','revoked'].includes(key.state), 'relay_key_state_invalid', 503); assert(key.state !== 'revoked', 'relay_key_revoked', 401);
  const issued = Date.parse(envelope.issuedAt); const validFrom = Date.parse(key.validFrom); const validUntil = key.validUntil == null ? Infinity : Date.parse(key.validUntil);
  assert(Number.isFinite(validFrom) && (key.validUntil == null || Number.isFinite(validUntil)), 'relay_key_window_invalid', 503);
  assert(issued >= validFrom && issued <= validUntil, 'relay_key_outside_window', 401);
  const publicKey = await crypto.subtle.importKey('jwk', key.publicKeyJwk, { name: 'Ed25519' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, decodeBase64Url64(envelope.signature.valueBase64Url), new TextEncoder().encode(canonicalizeRelayJcsV31(unsignedEnvelope(envelope))));
  assert(ok, 'relay_signature_invalid', 401);
  return { member: key.member, keyId: key.keyId, state: key.state, validFrom: key.validFrom, validUntil: key.validUntil ?? null };
}
async function currentGitHubHead(repository, branch, fetchImpl = fetch) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/branches/${encodeURIComponent(branch)}`, { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'chief-federated-relay-v31' } });
  if (response.status === 404) return null;
  assert(response.ok, 'relay_source_head_provider_failed', 503);
  const data = await response.json(); return typeof data?.commit?.sha === 'string' ? data.commit.sha : null;
}
function localIdentity(env) {
  const sha = [env?.RELEASE_SHA, env?.GITHUB_SHA, env?.WORKERS_CI_COMMIT_SHA].find((value) => typeof value === 'string' && SHA40_RE.test(value));
  assert(sha, 'relay_runtime_sha_unavailable', 503);
  return { member: 'chief-ai-machine', repository: 'jussray/chief-ai-machine', branch: env?.FEDERATED_RELAY_BRANCH || 'main', headSha: sha };
}
async function supabaseRequest(env, path, init = {}, fetchImpl = fetch) {
  assert(typeof env.RELAY_SUPABASE_URL === 'string' && typeof env.RELAY_SUPABASE_SERVICE_ROLE_KEY === 'string', 'relay_ledger_unconfigured', 503);
  const response = await fetchImpl(`${env.RELAY_SUPABASE_URL.replace(/\/$/u, '')}${path}`, { ...init, headers: { apikey: env.RELAY_SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.RELAY_SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  const text = await response.text(); let data = null; if (text) { try { data = JSON.parse(text); } catch { data = text; } }
  if (!response.ok) throw new RelayV31Error(typeof data?.message === 'string' ? data.message : 'relay_database_error', response.status >= 500 ? 503 : 409);
  return data;
}
async function findExisting(env, messageId, fetchImpl) {
  const select = 'message_id,semantic_fingerprint,delivery_fingerprint,receipt,status,superseded_by_message_id';
  const data = await supabaseRequest(env, `/rest/v1/federated_relay_messages?message_id=eq.${encodeURIComponent(messageId)}&select=${encodeURIComponent(select)}&limit=1`, { method: 'GET', headers: { Accept: 'application/json' } }, fetchImpl);
  return Array.isArray(data) && data.length ? data[0] : null;
}
async function signReceipt(unsignedReceipt, env) {
  assert(typeof env.FEDERATED_RELAY_RECEIPT_PRIVATE_JWK === 'string' && typeof env.FEDERATED_RELAY_RECEIPT_KEY_ID === 'string', 'relay_receipt_signer_unconfigured', 503);
  let jwk; try { jwk = JSON.parse(env.FEDERATED_RELAY_RECEIPT_PRIVATE_JWK); } catch { throw new RelayV31Error('relay_receipt_signer_invalid', 503); }
  const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'Ed25519' }, privateKey, new TextEncoder().encode(canonicalizeRelayJcsV31(unsignedReceipt))));
  return { algorithm: 'Ed25519', keyId: env.FEDERATED_RELAY_RECEIPT_KEY_ID, valueBase64Url: encodeBase64Url(signature) };
}
async function acceptEnvelope(envelope, env, fetchImpl = fetch) {
  validateFreshness(envelope); const key = await verifySignature(envelope, env);
  const semanticFingerprint = await semanticFingerprintV31(envelope); const deliveryFingerprint = await deliveryFingerprintV31(envelope);
  const existing = await findExisting(env, envelope.messageId, fetchImpl);
  if (existing) {
    assert(existing.semantic_fingerprint === semanticFingerprint && existing.delivery_fingerprint === deliveryFingerprint, 'relay_message_id_collision', 409);
    return { outcome: 'duplicate', receipt: existing.receipt, currentState: existing.status, supersededByMessageId: existing.superseded_by_message_id ?? null };
  }
  assert(await sha256HexV31(envelope.payload.body) === envelope.payload.sha256, 'relay_payload_digest_mismatch');
  const local = localIdentity(env); assert(envelope.target.member === local.member && envelope.target.repository === local.repository && envelope.target.branch === local.branch && envelope.target.headSha === local.headSha, 'relay_target_head_stale', 409);
  const sourceHead = await currentGitHubHead(envelope.source.repository, envelope.source.branch, fetchImpl); assert(sourceHead === envelope.source.headSha, 'relay_source_head_stale', 409);
  const evidenceDigest = await evidenceDigestV31(envelope.evidence); const successorProofCookie = await successorCookieV31(envelope, deliveryFingerprint);
  const unsignedReceipt = { contract: RECEIPT_CONTRACT, status: 'accepted', receiptId: crypto.randomUUID(), messageId: envelope.messageId, semanticFingerprint, deliveryFingerprint, chainId: envelope.ordering.chainId, chainPosition: envelope.ordering.chainPosition, receiver: local, sourceHeadSha: envelope.source.headSha, targetObservedHeadSha: local.headSha, sourceCommitEvidence: { repository: envelope.source.repository, branch: envelope.source.branch, headSha: envelope.source.headSha, state: 'current_head_at_acceptance', checkedAt: new Date().toISOString() }, predecessorProofCookie: envelope.predecessorProofCookie, successorProofCookie, evidenceDigest, acceptedKeyState: key, acceptedAt: new Date().toISOString(), executionAuthorized: false, authorityTransferred: false, approvalCarriedForward: false, nextGate: 'Relay acceptance records signed evidence only. Local policy and authority must be independently revalidated before mutation.' };
  const receipt = { ...unsignedReceipt, signature: await signReceipt(unsignedReceipt, env) };
  const relation = envelope.ordering.relation;
  const rpc = await supabaseRequest(env, '/rest/v1/rpc/federated_relay_accept_v31', { method: 'POST', body: JSON.stringify({ p_contract: envelope.contract, p_message_id: envelope.messageId, p_semantic_fingerprint: semanticFingerprint, p_delivery_fingerprint: deliveryFingerprint, p_receipt_id: receipt.receiptId, p_chain_id: envelope.ordering.chainId, p_chain_position: envelope.ordering.chainPosition, p_relation_type: relation.type, p_parent_message_id: relation.type === 'root' ? null : relation.parentMessageId, p_logical_operation_id: envelope.ordering.logicalOperationId, p_source_member: envelope.source.member, p_source_repository: envelope.source.repository, p_source_branch: envelope.source.branch, p_source_head_sha: envelope.source.headSha, p_source_key_id: envelope.signature.keyId, p_source_sequence: envelope.ordering.sourceSequence, p_target_member: envelope.target.member, p_target_repository: envelope.target.repository, p_target_branch: envelope.target.branch, p_target_head_sha: envelope.target.headSha, p_nonce: envelope.nonce, p_reply_to_message_id: envelope.replyToMessageId ?? null, p_predecessor_proof_cookie: envelope.predecessorProofCookie, p_successor_proof_cookie: successorProofCookie, p_payload_sha256: envelope.payload.sha256, p_evidence_digest: evidenceDigest, p_accepted_key_state: key, p_issued_at: envelope.issuedAt, p_expires_at: envelope.expiresAt, p_envelope: envelope, p_receipt: receipt, p_supersedes_message_ids: envelope.supersedesMessageIds }) }, fetchImpl);
  const row = Array.isArray(rpc) ? rpc[0] : rpc; assert(row && ['accepted','duplicate'].includes(row.outcome) && row.stored_receipt, 'relay_database_result_invalid', 503);
  return { outcome: row.outcome, receipt: row.stored_receipt, currentState: row.current_state, supersededByMessageId: row.superseded_by_message_id ?? null };
}
export async function handleFederatedRelayV31(request, env, fetchImpl = fetch) {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: { Allow: 'POST' } });
  try {
    assert((request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase() === 'application/json', 'relay_content_type', 415);
    const raw = await readBoundedBody(request); const envelope = parseCanonicalEnvelopeV31(raw); const result = await acceptEnvelope(envelope, env, fetchImpl);
    return Response.json(result, { status: result.outcome === 'accepted' ? 201 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const known = error instanceof RelayV31Error; const status = known ? error.status : 500; const code = known ? error.code : 'relay_internal_error';
    return Response.json({ ok: false, error: code, executionAuthorized: false, authorityTransferred: false, approvalCarriedForward: false }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
