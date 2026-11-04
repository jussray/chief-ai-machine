const allowedHost = (hostname) => hostname === 'chief-ai.mcgill-raylene.workers.dev'
  || /^[a-f0-9]{8}-chief-ai\.mcgill-raylene\.workers\.dev$/.test(hostname);

function validChiefOrigin(raw) {
  let url;
  try { url = new URL(raw); } catch { throw new Error('Invalid Chief proof origin'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || url.search || url.hash || url.pathname !== '/' || !allowedHost(url.hostname)) {
    throw new Error('Unapproved Chief proof origin');
  }
  return url.origin;
}

// Secrets are only given to an approved Chief origin, as an inseparable pair.
export function chiefAccessHeaders(env, rawOrigin) {
  validChiefOrigin(rawOrigin);
  const id = String(env?.CLOUDFLARE_ACCESS_CLIENT_ID ?? '');
  const secret = String(env?.CLOUDFLARE_ACCESS_CLIENT_SECRET ?? '');
  if (Boolean(id) !== Boolean(secret)) throw new Error('Incomplete Cloudflare Access service-token pair');
  if (!id) return {};
  return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret };
}

// APIRequestContext follows redirects unless told otherwise. Never let
// authenticated requests escape the exact, pre-validated Chief origin.
export function createChiefBoundRequest(client, rawOrigin) {
  const origin = validChiefOrigin(rawOrigin);
  const invoke = (method, rawUrl, options = {}) => {
    if (typeof rawUrl !== 'string' || !rawUrl.startsWith('https://')) {
      throw new Error('Chief proof requires an absolute HTTPS URL');
    }
    let url;
    try { url = new URL(rawUrl); } catch { throw new Error('Invalid Chief proof URL'); }
    if (url.origin !== origin || url.username || url.password || url.search || url.hash
      || !['/version', '/mcp'].includes(url.pathname)) {
      throw new Error('Chief proof request exceeds approved origin or path');
    }
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('Invalid Chief proof request options');
    }
    if (options.maxRedirects !== undefined && options.maxRedirects !== 0) {
      throw new Error('Chief proof redirects must remain disabled');
    }
    if (options.headers && Object.keys(options.headers).some((name) =>
      /^cf-access-client-(id|secret)$/i.test(name))) {
      throw new Error('Chief proof credentials cannot be overridden by test requests');
    }
    return client[method](url.href, { ...options, maxRedirects: 0 });
  };
  return Object.freeze({
    get: (url, options) => invoke('get', url, options),
    post: (url, options) => invoke('post', url, options),
  });
}
