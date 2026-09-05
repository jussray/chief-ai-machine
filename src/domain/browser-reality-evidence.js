// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { sha256Hex } from './capability-plan.js';

export const BROWSER_REALITY_CONTRACT_ID = 'juss/browser-reality@v1';
export const BROWSER_REALITY_FINGERPRINT_CONTRACT = 'juss-browser-reality-canonical-json-v1';
export const BROWSER_REALITY_TRUTH_STATES = Object.freeze([
  'VERIFIED',
  'INFERRED',
  'UNKNOWN',
  'BLOCKED',
]);

const REQUIRED_TOP_LEVEL_FIELDS = Object.freeze([
  'contractId',
  'authorizedInputUrl',
  'finalUrl',
  'observedAt',
  'scope',
  'observations',
]);
const OPTIONAL_TOP_LEVEL_FIELDS = Object.freeze(['screenshotSha256']);
const TOP_LEVEL_FIELDS = new Set([...REQUIRED_TOP_LEVEL_FIELDS, ...OPTIONAL_TOP_LEVEL_FIELDS]);
const OBSERVATION_FIELDS = new Set(['state', 'statement']);
const MAX_NESTED_URL_DEPTH = 3;
const NESTED_URL_DEPTH_REDACTION = 'REDACTED_NESTED_URL';
const TRUTH_STATE_RANK = new Map(BROWSER_REALITY_TRUTH_STATES.map((state, index) => [state, index]));
const HASH = /^[0-9a-f]{64}$/i;
const TRACKING_QUERY_KEYS = new Set([
  'dclid',
  'fbclid',
  'gclid',
  'mibextid',
  'msclkid',
  'rdid',
  'share_url',
]);
const SENSITIVE_QUERY_KEYS = new Set([
  'accesstoken',
  'apikey',
  'auth',
  'authorization',
  'clientsecret',
  'code',
  'connectsid',
  'cookie',
  'cookies',
  'credential',
  'credentials',
  'csrftoken',
  'encryptedcontext',
  'idtoken',
  'jsessionid',
  'jwt',
  'key',
  'oauth',
  'oauthtoken',
  'password',
  'phpsessid',
  'refreshtoken',
  'secret',
  'session',
  'sessionid',
  'sid',
  'sig',
  'signature',
  'state',
  'token',
  'xsrftoken',
]);
const FORBIDDEN_FIELD = /(?:cookie|credential|password|secret|token|session|device|browser|entropy|hardware|fingerprint|(?:user|person|account|advertising)[_-]?id|unrelated.?private|raw.?private)/i;

function utf16Compare(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function plainRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be a plain object`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${label} must be a plain object`);
  }
  return value;
}

function assertAllowedFields(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (allowed.has(key)) continue;
    if (FORBIDDEN_FIELD.test(key)) throw new Error(`${label} contains forbidden field: ${key}`);
    throw new Error(`${label} contains unsupported field: ${key}`);
  }
}

function assertRequiredFields(value, required, label) {
  for (const key of required) {
    if (!Object.hasOwn(value, key)) throw new Error(`${label}.${key} is required`);
  }
}

function normalizedText(value, label, maxLength) {
  if (typeof value !== 'string') throw new Error(`${label} must be a string`);
  const text = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (!text) throw new Error(`${label} is required`);
  if (text.length > maxLength) throw new Error(`${label} exceeds ${maxLength} characters`);
  return text;
}

function isTrackingQueryKey(key) {
  const normalized = key.normalize('NFC').toLowerCase();
  return normalized.startsWith('utm_') || TRACKING_QUERY_KEYS.has(normalized);
}

function isSensitiveQueryKey(key) {
  return SENSITIVE_QUERY_KEYS.has(
    key.normalize('NFC').toLowerCase().replace(/[^a-z0-9]/g, ''),
  );
}

function sanitizeDecodedQueryValue(rawValue, label, depth) {
  const normalized = rawValue.normalize('NFC');
  let nested;
  try {
    nested = new URL(normalized);
  } catch {
    return normalized;
  }
  if (!['http:', 'https:'].includes(nested.protocol)) return normalized;
  if (depth >= MAX_NESTED_URL_DEPTH) return NESTED_URL_DEPTH_REDACTION;
  return sanitizeBrowserRealityUrl(normalized, `${label} nested URL`, depth + 1);
}

export function sanitizeBrowserRealityUrl(value, label = 'Browser reality URL', depth = 0) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) {
    throw new Error(`${label} must be a non-empty string no longer than 4096 characters`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be an absolute URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error(`${label} must use http or https`);
  }

  const queryEntries = [];
  url.searchParams.forEach((queryValue, key) => queryEntries.push([key, queryValue]));
  const query = queryEntries
    .map(([key, queryValue]) => [key.normalize('NFC'), queryValue.normalize('NFC')])
    .filter(([key]) => !isTrackingQueryKey(key))
    .map(([key, queryValue]) => {
      if (isSensitiveQueryKey(key)) return [key, 'REDACTED'];
      return [key, sanitizeDecodedQueryValue(queryValue, label, depth)];
    })
    .sort((left, right) => utf16Compare(left[0], right[0]) || utf16Compare(left[1], right[1]));

  url.search = '';
  const sanitizedQuery = url.searchParams;
  for (const [key, queryValue] of query) sanitizedQuery.append(key, queryValue);

  const hostname = url.hostname.toLowerCase();
  const renderedHost = hostname.startsWith('[') ? hostname : hostname.includes(':') ? `[${hostname}]` : hostname;
  const port = url.port ? `:${url.port}` : '';
  const pathname = url.pathname || '/';
  const search = sanitizedQuery.size > 0 ? `?${sanitizedQuery.toString()}` : '';
  return `${url.protocol.toLowerCase()}//${renderedHost}${port}${pathname}${search}`;
}

function normalizeObservedAt(value) {
  if (typeof value !== 'string') throw new Error('observedAt must be a string');
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) throw new Error('observedAt must be a valid timestamp');
  return timestamp.toISOString();
}

function normalizeObservations(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('observations must contain at least one truth-labeled observation');
  }
  if (value.length > 64) throw new Error('observations exceeds 64 items');

  const normalized = value.map((item, index) => {
    const observation = plainRecord(item, `observations[${index}]`);
    assertAllowedFields(observation, OBSERVATION_FIELDS, `observations[${index}]`);
    const state = observation.state;
    if (!TRUTH_STATE_RANK.has(state)) {
      throw new Error(`observations[${index}].state is unsupported`);
    }
    return {
      state,
      statement: normalizedText(observation.statement, `observations[${index}].statement`, 1000),
    };
  });

  const unique = new Map(normalized.map((item) => [`${item.state}\u0000${item.statement}`, item]));
  return [...unique.values()].sort((left, right) => (
    TRUTH_STATE_RANK.get(left.state) - TRUTH_STATE_RANK.get(right.state)
    || utf16Compare(left.statement, right.statement)
  ));
}

function normalizeScreenshotSha256(value) {
  if (typeof value !== 'string' || !HASH.test(value)) {
    throw new Error('screenshotSha256 must be a 64-character SHA-256 hex digest');
  }
  return value.toLowerCase();
}

function canonicalValue(value) {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    plainRecord(value, 'Canonical JSON object');
    return Object.fromEntries(
      Object.keys(value).sort(utf16Compare).map((key) => [key, canonicalValue(value[key])]),
    );
  }
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  throw new Error('Canonical JSON contains an unsupported value');
}

export function canonicalBrowserRealityJson(value) {
  return JSON.stringify(canonicalValue(value));
}

export function canonicalizeBrowserRealityEvidence(input) {
  const source = plainRecord(input, 'Browser reality evidence');
  assertRequiredFields(source, REQUIRED_TOP_LEVEL_FIELDS, 'Browser reality evidence');
  assertAllowedFields(source, TOP_LEVEL_FIELDS, 'Browser reality evidence');
  if (source.contractId !== BROWSER_REALITY_CONTRACT_ID) {
    throw new Error(`contractId must be ${BROWSER_REALITY_CONTRACT_ID}`);
  }
  const canonical = {
    contractId: source.contractId,
    authorizedInputUrl: sanitizeBrowserRealityUrl(source.authorizedInputUrl, 'authorizedInputUrl'),
    finalUrl: sanitizeBrowserRealityUrl(source.finalUrl, 'finalUrl'),
    observedAt: normalizeObservedAt(source.observedAt),
    scope: normalizedText(source.scope, 'scope', 160),
    observations: normalizeObservations(source.observations),
  };
  if (Object.hasOwn(source, 'screenshotSha256')) {
    canonical.screenshotSha256 = normalizeScreenshotSha256(source.screenshotSha256);
  }

  const canonicalJson = canonicalBrowserRealityJson(canonical);
  return {
    canonical,
    canonicalJson,
    digest: sha256Hex(canonicalJson),
  };
}

export function createBrowserRealityEvidenceReceipt(input) {
  const result = canonicalizeBrowserRealityEvidence(input);
  return {
    ...result.canonical,
    evidenceFingerprint: {
      contract: BROWSER_REALITY_FINGERPRINT_CONTRACT,
      algorithm: 'sha256',
      digest: result.digest,
      purpose: 'evidence-binding-not-person-or-device-identity',
      identityUse: 'forbidden',
      crossSiteCorrelation: false,
    },
  };
}
