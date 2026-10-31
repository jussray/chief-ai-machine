const CONTRACT = 'juss/federated-agent-relay@v3.1';
const GENESIS_COOKIE = 'Q4R:v3.1:genesis';
const MAX_ENVELOPE_BYTES = 512 * 1024;
const MAX_PAYLOAD_BYTES = 256 * 1024;
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
function hex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export async function sha256HexV31(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return hex(await sha256Bytes(bytes));
}
function unsignedEnvelope(envelope) {
  const { signature: _signature, ...unsigned } = envelope;
  return unsigned;
}
export async function semanticFingerprintV31(envelope) {
  return sha256HexV31(canonicalizeRelayJcsV31(unsignedEnvelope(envelope)));
}
export async function deliveryFingerprintV31(envelope) {
  return sha256HexV31(canonicalizeRelayJcsV31(envelope));
}

function decodeBase64Url64(value) {
  assert(typeof value === 'string' && value.length === 86 && BASE64URL_RE.test(value), 'relay_signature_base64url_invalid', 401);
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  let binary;
  try {
    binary = atob(`${normalized}${'='.repeat((4 - (normalized.length % 4)) % 4)}`);
  } catch {
    throw new RelayV31Error('relay_signature_base64url_invalid', 401);
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  assert(bytes.byteLength === 64, 'relay_signature_length_invalid', 401);
  const canonical = btoa(String.fromCharCode(...bytes)).replace(/=+$/u, '').replace(/\+/g, '-').replace(/\//g, '_');
  assert(canonical === value, 'relay_signature_base64url_noncanonical', 401);
  return bytes;
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
  memberIdentity(envelope.source, 'relay_source');
  memberIdentity(envelope.target, 'relay_target');
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
  for (const id of envelope.supersedesMessageIds) {
    assert(UUID_RE.test(id), 'relay_supersedes_message_id');
    assert(id !== envelope.messageId && !supersedes.has(id), 'relay_supersession_invalid');
    supersedes.add(id);
  }
  if (envelope.ordering.relation.type === 'revision') assert(envelope.supersedesMessageIds.length > 0, 'relay_revision_without_supersession');
  else assert(envelope.supersedesMessageIds.length === 0, 'relay_supersession_requires_revision');
  exactKeys(envelope.signature, ['algorithm','keyId','valueBase64Url'], 'relay_signature');
  assert(envelope.signature.algorithm === 'Ed25519', 'relay_signature_algorithm');
  assert(typeof envelope.signature.keyId === 'string' && envelope.signature.keyId.length > 0 && envelope.signature.keyId.length <= 200, 'relay_signature_key_id');
  decodeBase64Url64(envelope.signature.valueBase64Url);
}

function assertNoDuplicateObjectKeys(raw) {
  const stack = [];
  let index = 0;
  while (index < raw.length) {
    const char = raw[index];
    if (char === '"') {
      const start = index;
      index += 1;
      let escaped = false;
      while (index < raw.length) {
        const next = raw[index];
        if (escaped) escaped = false;
        else if (next === '\\') escaped = true;
        else if (next === '"') break;
        index += 1;
      }
      assert(index < raw.length, 'relay_json_invalid');
      const decoded = JSON.parse(raw.slice(start, index + 1));
      let lookahead = index + 1;
      while (/\s/u.test(raw[lookahead] ?? '')) lookahead += 1;
      const current = stack.at(-1);
      if (current?.type === '{' && raw[lookahead] === ':') {
        assert(!current.keys.has(decoded), 'relay_json_duplicate_key');
        current.keys.add(decoded);
      }
    } else if (char === '{') stack.push({ type: '{', keys: new Set() });
    else if (char === '[') stack.push({ type: '[' });
    else if (char === '}' || char === ']') stack.pop();
    index += 1;
  }
}

export function parseCanonicalEnvelopeV31(raw) {
  assert(typeof raw === 'string' && new TextEncoder().encode(raw).byteLength <= MAX_ENVELOPE_BYTES, 'relay_envelope_too_large', 413);
  assertNoDuplicateObjectKeys(raw);
  let envelope;
  try { envelope = JSON.parse(raw); } catch { throw new RelayV31Error('relay_json_invalid'); }
  assert(raw === canonicalizeRelayJcsV31(envelope), 'relay_transport_not_canonical_jcs');
  assertEnvelopeV31(envelope);
  return envelope;
}
