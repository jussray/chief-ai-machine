import { Buffer } from 'node:buffer';

import { describe, expect, it } from 'vitest';

import {
  createGitHubAppJwt,
  handleGitHubAppRequest,
  requestGitHubInstallationToken,
  verifyGitHubWebhookSignature,
} from '../worker/github-app.js';

async function signWebhook(body, secret) {
  const encoder = new globalThis.TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(
    await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(body)),
  );
  const hex = [...digest]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `sha256=${hex}`;
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(`${normalized}${padding}`, 'base64');
}

describe('Chief GitHub App boundary', () => {
  it('reports configuration state without leaking credentials', async () => {
    const response = await handleGitHubAppRequest(
      new Request('https://chief-ai.example/github/status'),
      {
        GITHUB_APP_ID: '12345',
        GITHUB_PRIVATE_KEY: 'private-key-value',
        GITHUB_WEBHOOK_SECRET: 'webhook-secret-value',
      },
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      ok: true,
      configured: true,
      appAuthConfigured: true,
      webhookConfigured: true,
      authority: 'read-only',
      webhookPath: '/github/webhook',
      apiVersion: '2026-03-10',
    });
    expect(JSON.stringify(body)).not.toContain('private-key-value');
    expect(JSON.stringify(body)).not.toContain('webhook-secret-value');
  });

  it('fails closed when webhook verification is not configured', async () => {
    const response = await handleGitHubAppRequest(
      new Request('https://chief-ai.example/github/webhook', {
        method: 'POST',
        body: '{}',
      }),
      {},
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'github_webhook_not_configured',
    });
  });

  it('rejects an invalid webhook signature', async () => {
    const response = await handleGitHubAppRequest(
      new Request('https://chief-ai.example/github/webhook', {
        method: 'POST',
        headers: {
          'X-GitHub-Event': 'push',
          'X-Hub-Signature-256': 'sha256=bad',
        },
        body: '{}',
      }),
      { GITHUB_WEBHOOK_SECRET: 'correct-secret' },
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'invalid_webhook_signature',
    });
  });

  it('accepts a signed ping and returns an evidence receipt', async () => {
    const body = JSON.stringify({
      hook_id: 77,
      installation: { id: 101 },
      repository: { full_name: 'jussray/chief-ai-machine' },
    });
    const secret = 'test-webhook-secret';
    const signature = await signWebhook(body, secret);
    expect(await verifyGitHubWebhookSignature(body, signature, secret)).toBe(true);

    const response = await handleGitHubAppRequest(
      new Request('https://chief-ai.example/github/webhook', {
        method: 'POST',
        headers: {
          'X-GitHub-Event': 'ping',
          'X-GitHub-Delivery': 'delivery-123',
          'X-Hub-Signature-256': signature,
        },
        body,
      }),
      { GITHUB_WEBHOOK_SECRET: secret },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      accepted: true,
      event: 'ping',
      delivery: 'delivery-123',
      installationId: 101,
      repository: 'jussray/chief-ai-machine',
      action: null,
      authority: 'read-only',
    });
  });

  it('creates a verifiable RS256 GitHub App JWT', async () => {
    const keyPair = await globalThis.crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: Uint8Array.of(1, 0, 1),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const pkcs8 = await globalThis.crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const base64 = Buffer.from(pkcs8).toString('base64');
    const lines = base64.match(/.{1,64}/g) || [];
    const pem = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`;
    const now = Date.UTC(2026, 8, 21, 4, 0, 0);

    const jwt = await createGitHubAppJwt('12345', pem, { now });
    const [header, payload, signature] = jwt.split('.');
    expect(JSON.parse(decodeBase64Url(header).toString('utf8'))).toEqual({
      alg: 'RS256',
      typ: 'JWT',
    });
    expect(JSON.parse(decodeBase64Url(payload).toString('utf8'))).toEqual({
      iat: Math.floor(now / 1000) - 60,
      exp: Math.floor(now / 1000) + 540,
      iss: '12345',
    });

    const verified = await globalThis.crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      keyPair.publicKey,
      decodeBase64Url(signature),
      new globalThis.TextEncoder().encode(`${header}.${payload}`),
    );
    expect(verified).toBe(true);
  });

  it('requests an installation token with the GitHub App JWT and current API version', async () => {
    const calls = [];
    const token = await requestGitHubInstallationToken({
      installationId: 99,
      appId: '12345',
      privateKeyPem: 'unused-by-test-jwt-factory',
      jwtFactory: async () => 'signed-app-jwt',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({
          token: 'installation-token',
          expires_at: '2026-09-21T05:00:00Z',
        }), { status: 201 });
      },
    });

    expect(token).toEqual({
      token: 'installation-token',
      expires_at: '2026-09-21T05:00:00Z',
    });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://api.github.com/app/installations/99/access_tokens',
    );
    expect(calls[0].options.method).toBe('POST');
    expect(calls[0].options.headers).toMatchObject({
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer signed-app-jwt',
      'X-GitHub-Api-Version': '2026-03-10',
      'User-Agent': 'Chief-AI-GitHub-App',
    });
  });
});
