const RATE_LIMIT_BINDING = 'CHIEF_RATE_LIMITER';
const RATE_LIMIT_WINDOW_SECONDS = 60;

export function isChiefDynamicPath(pathname) {
  return pathname === '/version'
    || pathname === '/mcp'
    || pathname.startsWith('/github/')
    || pathname === '/api'
    || pathname.startsWith('/api/');
}

function clientKey(request) {
  const cfIp = String(request.headers.get('cf-connecting-ip') || '').trim();
  if (cfIp) return `ip:${cfIp}`;

  const forwarded = String(request.headers.get('x-forwarded-for') || '')
    .split(',')[0]
    .trim();
  if (forwarded) return `ip:${forwarded}`;

  return 'ip:unknown';
}

function json(status, body, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders,
    },
  });
}

export async function enforceChiefEdgeRateLimit(request, env) {
  const pathname = new URL(request.url).pathname;
  if (!isChiefDynamicPath(pathname)) return null;

  const limiter = env?.[RATE_LIMIT_BINDING];
  if (!limiter || typeof limiter.limit !== 'function') {
    return json(503, {
      ok: false,
      error: 'rate_limit_unavailable',
    });
  }

  const { success } = await limiter.limit({ key: clientKey(request) });
  if (success) return null;

  return json(
    429,
    { ok: false, error: 'rate_limit_exceeded' },
    { 'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS) },
  );
}
