import { ATTACK_UNIT_MEMBERS, runFullAttackUnit } from './full-attack-unit.mjs';

const HALLWAY_BASE_EXPANSION = 48_000;
const HALLWAY_RANDOM_MAX = 47_999;
export const FULL_ATTACK_UNIT = ATTACK_UNIT_MEMBERS;

const AUTOMATION_UA = /(bot|crawler|spider|scanner|headless|curl|wget|python-requests|go-http-client|httpclient|zgrab|sqlmap|nikto|masscan|nmap)/i;
const CLAIMS = Object.freeze([
  ['googlebot', /googlebot/i],
  ['bingbot', /bingbot/i],
  ['applebot', /applebot/i],
  ['gptbot', /gptbot/i],
  ['chatgpt-user', /chatgpt-user/i],
  ['claudebot', /claudebot/i],
]);
const PROBE_PATHS = Object.freeze([
  '/.env','/.git','/.aws','/.ssh','/wp-admin','/wp-login.php','/phpmyadmin','/server-status','/etc/passwd','/vendor/phpunit','/actuator','/.well-known/security.txt~',
]);

// eslint-disable-next-line no-control-regex -- intentional: strips control chars from untrusted input before logging
function clean(value, max = 256) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function claimedCrawler(userAgent) {
  return CLAIMS.find(([, pattern]) => pattern.test(userAgent))?.[0] ?? null;
}

function isProbePath(pathname) {
  const lower = pathname.toLowerCase();
  return PROBE_PATHS.some((candidate) => lower === candidate || lower.startsWith(`${candidate}/`));
}

function headerFromNode(request, name) {
  const value = request?.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value ?? null;
}

function firstForwarded(value) {
  return clean(String(value ?? '').split(',')[0], 96) || null;
}

function nonInferredAuthorization() {
  return Object.freeze({ state: 'NOT_EVALUATED', evidenceRefs: Object.freeze([]), derivedFromRuntimeSignals: false });
}

function safeBoundaries() {
  return {
    ownedSurfaceOnly: true,
    authorizationInferred: false,
    externalCompromise: false,
    externalExploit: false,
    outboundRetaliation: false,
    publicMetadataEnrichmentAllowed: true,
  };
}

function withUnit(observation) {
  return Object.freeze({ ...observation, unit: runFullAttackUnit(observation) });
}

function errorObservation(service, error) {
  return withUnit({
    schema: 'juss/reciprocal-ingress@v1',
    service,
    verdict: 'OBSERVE_ERROR',
    meaningful: true,
    error: clean(error?.message, 160),
    technicalIdentity: { actorFingerprint: null, claimedCrawler: null, verifiedBot: false },
    authorization: nonInferredAuthorization(),
    receipt: null,
    hallway: {
      active: false,
      baseExpansion: 0,
      randomExpansion: 0,
      logicalExpansion: 0,
      lazyMaterialization: true,
      productionExposure: 0,
      realCustomerData: false,
      realCredentials: false,
      crossSessionSharing: false,
    },
    boundaries: safeBoundaries(),
  });
}

async function buildObservation({ service, method, url, headers, cf = {}, sourceIp, secret }) {
  const userAgent = clean(headers.userAgent, 256);
  const pathname = new URL(url, 'http://local.invalid').pathname;
  const claimed = claimedCrawler(userAgent);
  const botManagement = cf?.botManagement ?? cf?.bot_management ?? {};
  const verifiedBot = botManagement?.verifiedBot === true || botManagement?.verified_bot === true;
  const botScore = Number.isFinite(Number(botManagement?.score)) ? Number(botManagement.score) : null;
  const asn = Number.isFinite(Number(cf?.asn)) ? Number(cf.asn) : null;
  const actorFingerprint = secret && sourceIp ? await hmac(secret, `ip:${sourceIp}`) : null;
  const obviousProbe = isProbePath(pathname) || method === 'TRACE' || method === 'CONNECT';
  const automated = verifiedBot || Boolean(claimed) || AUTOMATION_UA.test(userAgent) || (botScore !== null && botScore < 10);
  const verdict = obviousProbe
    ? 'HALLWAY'
    : verifiedBot
      ? 'VERIFIED_AUTOMATION'
      : claimed
        ? 'CLAIMED_AUTOMATION'
        : automated
          ? 'UNKNOWN_AUTOMATION'
          : 'OBSERVE';
  const meaningful = verdict !== 'OBSERVE';
  const technicalIdentity = {
    actorFingerprint,
    asn,
    country: clean(cf?.country, 8) || null,
    colo: clean(cf?.colo, 16) || null,
    userAgent: userAgent || null,
    claimedCrawler: claimed,
    verifiedBot,
    botScore,
    attributionConfidence: verifiedBot ? 'high' : actorFingerprint && asn ? 'medium' : 'low',
  };
  const event = {
    schema: 'juss/reciprocal-ingress@v1',
    service,
    method,
    pathname,
    verdict,
    meaningful,
    technicalIdentity,
    authorization: nonInferredAuthorization(),
    attackUnit: [...FULL_ATTACK_UNIT],
    attackUnitMode: 'all-applicable-every-meaningful-step',
    boundaries: safeBoundaries(),
  };
  const material = JSON.stringify(stable(event));
  const receipt = secret ? await hmac(secret, material) : await sha256(material);
  const randomExpansion = meaningful
    ? Number.parseInt(receipt.slice(0, 8), 16) % (HALLWAY_RANDOM_MAX + 1)
    : 0;

  return withUnit({
    ...event,
    receipt,
    hallway: {
      active: verdict === 'HALLWAY',
      baseExpansion: meaningful ? HALLWAY_BASE_EXPANSION : 0,
      randomExpansion,
      logicalExpansion: meaningful ? HALLWAY_BASE_EXPANSION + randomExpansion : 0,
      lazyMaterialization: true,
      productionExposure: 0,
      realCustomerData: false,
      realCredentials: false,
      crossSessionSharing: false,
    },
  });
}

export async function observeFetchRequest(request, env = {}, service = 'unknown') {
  try {
    const cf = request?.cf ?? {};
    return await buildObservation({
      service,
      method: clean(request?.method, 16).toUpperCase() || 'GET',
      url: request?.url ?? 'http://local.invalid/',
      headers: { userAgent: request?.headers?.get?.('user-agent') ?? '' },
      cf,
      sourceIp: firstForwarded(request?.headers?.get?.('cf-connecting-ip')),
      secret: clean(env?.RECIPROCAL_DEFENSE_SECRET, 4096) || null,
    });
  } catch (error) {
    return errorObservation(service, error);
  }
}

export async function observeNodeRequest(request, env = {}, service = 'unknown') {
  try {
    const sourceIp = firstForwarded(headerFromNode(request, 'cf-connecting-ip'))
      ?? firstForwarded(headerFromNode(request, 'x-forwarded-for'))
      ?? clean(request?.socket?.remoteAddress, 96)
      ?? null;
    return await buildObservation({
      service,
      method: clean(request?.method, 16).toUpperCase() || 'GET',
      url: request?.url ?? '/',
      headers: { userAgent: headerFromNode(request, 'user-agent') ?? '' },
      cf: {},
      sourceIp,
      secret: clean(env?.RECIPROCAL_DEFENSE_SECRET, 4096) || null,
    });
  } catch (error) {
    return errorObservation(service, error);
  }
}

export function emitReciprocalTelemetry(observation, context) {
  if (!observation?.meaningful) return;
  const task = Promise.resolve().then(() => console.log('[reciprocal-defense]', JSON.stringify(observation)));
  if (context?.waitUntil) context.waitUntil(task);
  else task.catch(() => undefined);
}

export function syntheticFetchResponse(observation) {
  const repair = observation?.unit?.unitVerdict === 'REPAIR_REQUIRED';
  if (!repair && observation?.verdict !== 'HALLWAY') return null;
  return new Response(JSON.stringify({ error: repair ? 'temporarily_unavailable' : 'not_found' }), {
    status: repair ? 503 : 404,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}

export function writeSyntheticNodeResponse(response, observation) {
  const repair = observation?.unit?.unitVerdict === 'REPAIR_REQUIRED';
  if (!repair && observation?.verdict !== 'HALLWAY') return false;
  response.writeHead(repair ? 503 : 404, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(JSON.stringify({ error: repair ? 'temporarily_unavailable' : 'not_found' }));
  return true;
}
