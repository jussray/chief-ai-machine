// Content Security Policy (report-only mode initially for safety)
// Prevents XSS, clickjacking, and other injection attacks

export function generateNonce() {
  // 16 random bytes encoded as base64 = 24 chars (standard nonce size)
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function buildCspHeader(nonce, reportOnly = true) {
  const policy = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    `style-src 'self' 'nonce-${nonce}' https://fonts.googleapis.com`,
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' https:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
  ].join('; ');

  return {
    headerName: reportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    value: policy,
  };
}

export function injectNonceIntoHtml(html) {
  // For any future inline scripts/styles added to index.html,
  // they would need nonce attributes. Currently the SPA has none,
  // so this is a safety placeholder.
  return html; // No inline scripts in current SPA
}
