// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const BROWSER_REALITY_MAX_REDIRECTS = 5;

/**
 * @typedef {(hostname: string) => Promise<string[]> | string[]} BrowserRealityResolver
 */

/**
 * @typedef {object} BrowserRealityNetworkAdmission
 * @property {string} url
 * @property {string} hostname
 * @property {string[]} resolvedAddresses
 */

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'home.arpa',
]);

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.home.arpa',
];

function normalizeHostname(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/\.$/, '');
}

/** @param {string} value */
function parseIpv4(value) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
  if (!match) return null;
  const octets = match.slice(1).map((part) => Number(part));
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return octets;
}

/** @param {number[]} octets */
function isPublicIpv4(octets) {
  const [a, b, c] = octets;

  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 0 && c === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 192 && b === 88 && c === 99) return false;
  if (a === 192 && b === 168) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;

  return true;
}

/** @param {string} value */
function isPublicIpv6(value) {
  const normalized = normalizeHostname(value);

  const mappedIpv4 = normalized.match(/(?:^|:)ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i)?.[1];
  if (mappedIpv4) {
    const octets = parseIpv4(mappedIpv4);
    return Boolean(octets && isPublicIpv4(octets));
  }

  const [firstRaw = '', secondRaw = ''] = normalized.split(':');
  if (!firstRaw) return false;

  const first = Number.parseInt(firstRaw, 16);
  const second = secondRaw ? Number.parseInt(secondRaw, 16) : 0;
  if (!Number.isFinite(first) || first < 0x2000 || first > 0x3fff) return false;

  // RFC 3849 documentation prefix is intentionally non-routable proof data.
  if (first === 0x2001 && second === 0x0db8) return false;

  return true;
}

/** @param {string} address */
export function isPublicBrowserRealityAddress(address) {
  const normalized = normalizeHostname(address);
  const ipv4 = parseIpv4(normalized);
  if (ipv4) return isPublicIpv4(ipv4);
  if (normalized.includes(':')) return isPublicIpv6(normalized);
  return false;
}

/** @param {string} hostname */
function isBlockedHostname(hostname) {
  const normalized = normalizeHostname(hostname);
  return BLOCKED_HOSTNAMES.has(normalized)
    || BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

/**
 * Fail-closed network admission for a Browser Reality navigation target.
 *
 * The caller must provide a resolver for DNS hostnames. Every resolved address
 * must be public. This function must be called before the first navigation and
 * again for every redirect target. Evidence URL sanitization is intentionally a
 * separate concern and is not a substitute for this admission check.
 *
 * @param {string} rawUrl
 * @param {BrowserRealityResolver} resolveHost
 * @returns {Promise<BrowserRealityNetworkAdmission>}
 */
export async function assertBrowserRealityPublicTarget(rawUrl, resolveHost) {
  if (typeof rawUrl !== 'string' || rawUrl.length === 0 || rawUrl.length > 4096) {
    throw new Error('Browser Reality target must be a non-empty URL no longer than 4096 characters');
  }

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Browser Reality target must be an absolute URL');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Browser Reality target must use http or https');
  }
  if (url.username || url.password) {
    throw new Error('Browser Reality target must not contain URL credentials');
  }

  const effectivePort = url.port || (url.protocol === 'https:' ? '443' : '80');
  if (!['80', '443'].includes(effectivePort)) {
    throw new Error(`Browser Reality target port ${effectivePort} is not allowed`);
  }

  const hostname = normalizeHostname(url.hostname);
  if (!hostname || isBlockedHostname(hostname)) {
    throw new Error(`Browser Reality target hostname is not public: ${hostname || 'missing'}`);
  }

  const literalAddress = parseIpv4(hostname) || hostname.includes(':');
  let resolvedAddresses;
  if (literalAddress) {
    resolvedAddresses = [hostname];
  } else {
    if (typeof resolveHost !== 'function') {
      throw new Error('Browser Reality DNS resolver is required for hostname admission');
    }
    const resolved = await resolveHost(hostname);
    if (!Array.isArray(resolved) || resolved.length === 0) {
      throw new Error(`Browser Reality target did not resolve to a public address: ${hostname}`);
    }
    resolvedAddresses = [...new Set(resolved.map((address) => normalizeHostname(String(address))))];
  }

  if (resolvedAddresses.length === 0 || resolvedAddresses.some((address) => !isPublicBrowserRealityAddress(address))) {
    throw new Error(`Browser Reality target resolved to a non-public address: ${hostname}`);
  }

  return {
    url: url.toString(),
    hostname,
    resolvedAddresses,
  };
}

/** @param {number} redirectCount */
export function assertBrowserRealityRedirectBudget(redirectCount) {
  if (!Number.isInteger(redirectCount) || redirectCount < 0) {
    throw new Error('Browser Reality redirect count must be a non-negative integer');
  }
  if (redirectCount > BROWSER_REALITY_MAX_REDIRECTS) {
    throw new Error(`Browser Reality redirect budget exceeded: ${redirectCount}`);
  }
  return redirectCount;
}
