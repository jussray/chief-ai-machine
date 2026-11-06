// Credentials are restricted to Chief's HTTPS Worker origins. Callers must not
// enable request traces or serialize transport exceptions containing headers.
export function proofmodeAccessHeaders(env, baseURL, required = false) {
  const id = env.CLOUDFLARE_ACCESS_CLIENT_ID || '';
  const secret = env.CLOUDFLARE_ACCESS_CLIENT_SECRET || '';
  if (!id && !secret && !required) return {};
  if (!/^[!-~]+$/.test(id) || !/^[!-~]+$/.test(secret)) {
    throw new Error('PROOFMODE_ACCESS_CREDENTIALS_REQUIRED');
  }
  let url;
  try { url = new URL(baseURL); } catch { throw new Error('PROOFMODE_ACCESS_ORIGIN_REJECTED'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port
    || url.search || url.hash || !['', '/'].includes(url.pathname)
    || !/^(?:[a-z0-9-]+-)?chief-ai\.mcgill-raylene\.workers\.dev$/.test(url.hostname)) {
    throw new Error('PROOFMODE_ACCESS_ORIGIN_REJECTED');
  }
  return { 'CF-Access-Client-Id': id, 'CF-Access-Client-Secret': secret };
}

export async function proofmodeRequest(request, baseURL, path, env, options = {}) {
  if (!['/version', '/mcp'].includes(path)) throw new Error('PROOFMODE_ACCESS_PATH_REJECTED');
  const accessHeaders = proofmodeAccessHeaders(env, baseURL, env.AUTHORIZE_PRODUCTION === 'true');
  try {
    return await request.fetch(`${baseURL}${path}`, {
      ...options,
      headers: { ...(options.headers || {}), ...accessHeaders },
      maxRedirects: 0,
    });
  } catch {
    // Playwright transport errors may include the full credential-bearing headers.
    throw new Error('PROOFMODE_HTTP_REQUEST_FAILED');
  }
}
