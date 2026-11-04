const GITHUB_API_VERSION = '2026-03-10';
const GITHUB_ACCEPT = 'application/vnd.github+json';
const encoder = new globalThis.TextEncoder();

function jsonResponse(payload, { status = 200, headers = {} } = {}) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function concatBytes(...chunks) {
  const size = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const output = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

function encodeDerLength(length) {
  if (length < 0x80) return Uint8Array.of(length);

  const bytes = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>>= 8;
  }

  return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function derElement(tag, value) {
  return concatBytes(Uint8Array.of(tag), encodeDerLength(value.length), value);
}

function wrapPkcs1AsPkcs8(pkcs1) {
  const version = Uint8Array.of(0x02, 0x01, 0x00);
  const rsaAlgorithmIdentifier = Uint8Array.of(
    0x30, 0x0d,
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
    0x05, 0x00,
  );
  const privateKey = derElement(0x04, pkcs1);

  return derElement(
    0x30,
    concatBytes(version, rsaAlgorithmIdentifier, privateKey),
  );
}

function pemToPkcs8(pem) {
  if (typeof pem !== 'string' || pem.trim() === '') {
    throw new TypeError('GitHub App private key must be a non-empty PEM string');
  }

  const isPkcs1 = pem.includes('-----BEGIN RSA PRIVATE KEY-----');
  const base64 = pem
    .replace(/-----BEGIN (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/-----END (?:RSA )?PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');

  if (!base64) {
    throw new TypeError('GitHub App private key is not a supported PEM private key');
  }

  let binary;
  try {
    binary = globalThis.atob(base64);
  } catch {
    throw new TypeError('GitHub App private key contains invalid base64');
  }

  const der = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return isPkcs1 ? wrapPkcs1AsPkcs8(der) : der;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return globalThis.btoa(binary);
}

function base64Url(bytes) {
  return bytesToBase64(bytes)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlText(value) {
  return base64Url(encoder.encode(value));
}

function bytesToHex(bytes) {
  return [...bytes]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function verifyGitHubWebhookSignature(
  rawBody,
  signature,
  secret,
  subtle = globalThis.crypto.subtle,
) {
  if (
    typeof rawBody !== 'string'
    || typeof signature !== 'string'
    || !signature.toLowerCase().startsWith('sha256=')
    || typeof secret !== 'string'
    || secret.length === 0
  ) {
    return false;
  }

  const key = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(
    await subtle.sign('HMAC', key, encoder.encode(rawBody)),
  );
  const expected = `sha256=${bytesToHex(digest)}`;

  return constantTimeEqual(expected, signature.toLowerCase());
}

export async function createGitHubAppJwt(
  appId,
  privateKeyPem,
  { now = Date.now(), subtle = globalThis.crypto.subtle } = {},
) {
  if (appId === undefined || appId === null || String(appId).trim() === '') {
    throw new TypeError('GitHub App ID is required');
  }

  const privateKey = await subtle.importKey(
    'pkcs8',
    pemToPkcs8(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const issuedAt = Math.floor(now / 1000) - 60;
  const header = base64UrlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlText(JSON.stringify({
    iat: issuedAt,
    exp: issuedAt + 600,
    iss: String(appId),
  }));
  const unsigned = `${header}.${payload}`;
  const signature = new Uint8Array(
    await subtle.sign(
      'RSASSA-PKCS1-v1_5',
      privateKey,
      encoder.encode(unsigned),
    ),
  );

  return `${unsigned}.${base64Url(signature)}`;
}

export async function requestGitHubInstallationToken({
  installationId,
  appId,
  privateKeyPem,
  fetchImpl = globalThis.fetch,
  jwtFactory = createGitHubAppJwt,
}) {
  if (installationId === undefined || installationId === null) {
    throw new TypeError('GitHub installation ID is required');
  }

  const jwt = await jwtFactory(appId, privateKeyPem);
  const response = await fetchImpl(
    `https://api.github.com/app/installations/${encodeURIComponent(String(installationId))}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: GITHUB_ACCEPT,
        Authorization: `Bearer ${jwt}`,
        'X-GitHub-Api-Version': GITHUB_API_VERSION,
        'User-Agent': 'Chief-AI-GitHub-App',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub installation token request failed (${response.status})`);
  }

  return response.json();
}

function configurationStatus(env) {
  const appAuthConfigured = Boolean(env.GITHUB_APP_ID && env.GITHUB_PRIVATE_KEY);
  const webhookConfigured = Boolean(env.GITHUB_WEBHOOK_SECRET);

  return {
    ok: true,
    configured: appAuthConfigured && webhookConfigured,
    appAuthConfigured,
    webhookConfigured,
    authority: 'read-only',
    webhookPath: '/github/webhook',
    apiVersion: GITHUB_API_VERSION,
  };
}

export async function handleGitHubAppRequest(request, env) {
  const url = new URL(request.url);

  if (url.pathname === '/github/status') {
    if (request.method !== 'GET') {
      return jsonResponse(
        { ok: false, error: 'method_not_allowed' },
        { status: 405, headers: { Allow: 'GET' } },
      );
    }
    return jsonResponse(configurationStatus(env));
  }

  if (url.pathname !== '/github/webhook') {
    return jsonResponse({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      { ok: false, error: 'method_not_allowed' },
      { status: 405, headers: { Allow: 'POST' } },
    );
  }

  if (!env.GITHUB_WEBHOOK_SECRET) {
    return jsonResponse(
      { ok: false, error: 'github_webhook_not_configured' },
      { status: 503 },
    );
  }

  const rawBody = await request.text();
  const signature = request.headers.get('X-Hub-Signature-256');
  const verified = await verifyGitHubWebhookSignature(
    rawBody,
    signature,
    env.GITHUB_WEBHOOK_SECRET,
  );

  if (!verified) {
    return jsonResponse(
      { ok: false, error: 'invalid_webhook_signature' },
      { status: 401 },
    );
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(
      { ok: false, error: 'invalid_json' },
      { status: 400 },
    );
  }

  const event = request.headers.get('X-GitHub-Event') || 'unknown';
  const receipt = {
    ok: true,
    accepted: true,
    event,
    delivery: request.headers.get('X-GitHub-Delivery'),
    installationId: payload.installation?.id ?? null,
    repository: payload.repository?.full_name ?? null,
    action: payload.action ?? null,
    authority: 'read-only',
  };

  return jsonResponse(receipt, { status: event === 'ping' ? 200 : 202 });
}
