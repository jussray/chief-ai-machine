import { buildFounderContentLearningSignal } from '../src/domain/founder-content-learning.js';
import { BUILD_RELEASE_SHA } from './release-sha.js';

export const FCR_LEARNING_ROUTE = '/api/chief/founder-content-learning';
export const FCR_LEARNING_TRANSPORT_CONTRACT = 'juss-v10/fcr-founder-content-learning-http@v1';
export const FCR_LEARNING_SOURCE = 'founder-control-room';

const HEX_SHA256 = /^[0-9a-f]{64}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const MAX_BODY_BYTES = 64 * 1024;
const MAX_AGE_MS = 5 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;
const encoder = new TextEncoder();

function text(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function json(payload, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}

function errorResponse(code, message, status) {
  return json({
    data: null,
    error: { code, message },
  }, status);
}

function bytesToHex(value) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(value) {
  if (!HEX_SHA256.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytes;
}

async function sha256Hex(value) {
  return bytesToHex(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

function signingInput(keyId, issuedAt, bodyHash) {
  return [FCR_LEARNING_TRANSPORT_CONTRACT, keyId, issuedAt, bodyHash].join('\n');
}

async function verifyHmac(secret, input, signatureHex) {
  const signature = hexToBytes(signatureHex);
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(input));
}

function parseAuthentication(request, env, nowMs) {
  const secret = text(env?.FCR_LEARNING_HMAC_SECRET, 4096);
  const configuredKeyId = text(env?.FCR_LEARNING_HMAC_KEY_ID, 160);
  if (!secret || !configuredKeyId) {
    return { error: errorResponse(
      'fcr_learning_authentication_unconfigured',
      'Authenticated FCR learning transport is not configured.',
      503,
    ) };
  }

  const keyId = text(request.headers.get('x-fcr-learning-key-id'), 160);
  const issuedAt = text(request.headers.get('x-fcr-learning-issued-at'), 64);
  const signature = text(request.headers.get('x-fcr-learning-signature'), 128).toLowerCase();
  if (!keyId || !issuedAt || !signature) {
    return { error: errorResponse(
      'fcr_learning_authentication_required',
      'FCR learning authentication headers are required.',
      401,
    ) };
  }
  if (keyId !== configuredKeyId || !HEX_SHA256.test(signature)) {
    return { error: errorResponse(
      'fcr_learning_authentication_failed',
      'FCR learning authentication failed.',
      401,
    ) };
  }
  if (!ISO_DATE.test(issuedAt)) {
    return { error: errorResponse(
      'fcr_learning_authentication_failed',
      'FCR learning authentication failed.',
      401,
    ) };
  }
  const issuedAtMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedAtMs)
      || issuedAtMs < nowMs - MAX_AGE_MS
      || issuedAtMs > nowMs + MAX_FUTURE_SKEW_MS) {
    return { error: errorResponse(
      'fcr_learning_authentication_expired',
      'FCR learning authentication is outside the accepted freshness window.',
      401,
    ) };
  }

  return { secret, keyId, issuedAt, signature };
}

export async function handleFounderContentLearning(request, env, nowMs = Date.now()) {
  const url = new URL(request.url);
  if (url.pathname !== FCR_LEARNING_ROUTE) {
    return errorResponse('not_found', 'Founder-content learning route not found.', 404);
  }
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 'POST is required for authenticated learning.', 405);
  }

  const effectiveNowMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const authentication = parseAuthentication(request, env, effectiveNowMs);
  if (authentication.error) return authentication.error;

  const rawBody = await request.text();
  if (encoder.encode(rawBody).byteLength > MAX_BODY_BYTES) {
    return errorResponse('founder_content_learning_payload_too_large', 'Learning payload exceeds 64 KiB.', 413);
  }

  const bodyHash = await sha256Hex(rawBody);
  const validSignature = await verifyHmac(
    authentication.secret,
    signingInput(authentication.keyId, authentication.issuedAt, bodyHash),
    authentication.signature,
  );
  if (!validSignature) {
    return errorResponse(
      'fcr_learning_authentication_failed',
      'FCR learning authentication failed.',
      401,
    );
  }

  let observation;
  try {
    observation = JSON.parse(rawBody);
  } catch {
    return errorResponse('invalid_founder_content_observation', 'Learning payload must be valid JSON.', 400);
  }

  let advisorySignal;
  try {
    advisorySignal = buildFounderContentLearningSignal(observation);
  } catch (error) {
    return errorResponse(
      'invalid_founder_content_observation',
      error instanceof Error ? error.message : 'Founder-content observation is invalid.',
      400,
    );
  }

  const receivedAt = new Date(effectiveNowMs).toISOString();
  const authenticatedSource = {
    version: 1,
    kind: 'chief-ai/founder-content-authenticated-source',
    transport_contract: FCR_LEARNING_TRANSPORT_CONTRACT,
    source_system: FCR_LEARNING_SOURCE,
    source_trust: 'fcr-hmac-authenticated',
    source_authentication: 'hmac-sha256',
    source_authentication_verified: true,
    source_key_id: authentication.keyId,
    issued_at: authentication.issuedAt,
    received_at: receivedAt,
    request_body_hash: bodyHash,
    source_observation_hash: advisorySignal.source_observation_hash,
    advisory_learning_hash: advisorySignal.learning_hash,
    dedupe_key: advisorySignal.source_observation_hash,
    chief_release_sha: BUILD_RELEASE_SHA,
  };

  return json({
    data: {
      advisorySignal,
      authenticatedSource: {
        ...authenticatedSource,
        authenticated_source_hash: await sha256Hex(JSON.stringify(authenticatedSource)),
      },
      authority: {
        evidence_only: true,
        learning_authority: 'advisory_only',
        execution_authorized: false,
        publish_authorized: false,
        content_mutation_authorized: false,
        may_increase_authority: false,
        authenticated_source_may_bypass_founder_approval: false,
      },
    },
    error: null,
  });
}
