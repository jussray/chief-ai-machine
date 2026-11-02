/* global Request */

import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import worker from '../worker/index.js';
import { generateNonce, buildCspHeader } from '../worker/csp-policy.js';
import { verifyStripeWebhookSignature } from '../worker/stripe-webhook-verify.js';

function stripeSignature(body, timestamp, secret) {
  const digest = createHmac('sha256', secret)
    .update(String(timestamp) + '.' + body)
    .digest('hex');
  return 't=' + timestamp + ',v1=' + digest;
}

describe('Worker Security Headers (Gate 3: CSP)', () => {
  it('generates unique nonce per request', () => {
    const nonce1 = generateNonce();
    const nonce2 = generateNonce();
    expect(nonce1).toHaveLength(32);
    expect(nonce2).toHaveLength(32);
    expect(nonce1).not.toBe(nonce2);
  });

  it('builds CSP header in report-only mode', () => {
    const nonce = 'abc123def456789012345678901234';
    const csp = buildCspHeader(nonce, true);
    expect(csp.headerName).toBe('Content-Security-Policy-Report-Only');
    expect(csp.value).toContain("script-src 'self' 'nonce-" + nonce + "'");
    expect(csp.value).toContain("default-src 'self'");
  });

  it('builds CSP header in enforce mode', () => {
    const nonce = 'abc123def456789012345678901234';
    const csp = buildCspHeader(nonce, false);
    expect(csp.headerName).toBe('Content-Security-Policy');
    expect(csp.value).toContain('frame-ancestors');
  });

  it('returns security headers on SPA and API responses', async () => {
    const env = {
      ASSETS: {
        fetch: () => new Response('<html></html>', { status: 200 }),
      },
    };

    for (const requestUrl of ['https://chief-ai.example/', 'https://chief-ai.example/version']) {
      const response = await worker.fetch(new Request(requestUrl), env);
      expect(response.headers.get('Content-Security-Policy-Report-Only')).toContain("default-src 'self'");
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    }
  });
});

describe('Stripe Webhook Verification (Gate 4: HMAC)', () => {
  const secret = 'whsec_test123456789';
  const nowSeconds = 1_700_000_000;
  const body = JSON.stringify({ id: 'evt_123', type: 'payment_intent.succeeded' });

  it('accepts a valid current Stripe HMAC', async () => {
    const signature = stripeSignature(body, nowSeconds, secret);
    await expect(
      verifyStripeWebhookSignature(body, signature, secret, { nowSeconds }),
    ).resolves.toBe(true);
  });

  it('rejects missing, malformed, tampered, and stale signatures', async () => {
    await expect(
      verifyStripeWebhookSignature(body, '', secret, { nowSeconds }),
    ).resolves.toBe(false);
    await expect(
      verifyStripeWebhookSignature(body, 'invalid_format', secret, { nowSeconds }),
    ).resolves.toBe(false);

    const validSignature = stripeSignature(body, nowSeconds, secret);
    await expect(
      verifyStripeWebhookSignature(body + 'tampered', validSignature, secret, { nowSeconds }),
    ).resolves.toBe(false);

    const staleTimestamp = nowSeconds - 301;
    const staleSignature = stripeSignature(body, staleTimestamp, secret);
    await expect(
      verifyStripeWebhookSignature(body, staleSignature, secret, { nowSeconds }),
    ).resolves.toBe(false);
  });

  it('rejects unsigned webhook requests and distinguishes verified-but-unhandled events', async () => {
    const env = {
      STRIPE_WEBHOOK_SECRET: secret,
      ASSETS: { fetch: () => new Response('asset', { status: 200 }) },
    };

    const unsigned = await worker.fetch(new Request('https://chief-ai.example/api/stripe-webhook', {
      method: 'POST',
      body,
    }), env);
    expect(unsigned.status).toBe(401);

    const signature = stripeSignature(body, Math.floor(Date.now() / 1000), secret);
    const verified = await worker.fetch(new Request('https://chief-ai.example/api/stripe-webhook', {
      method: 'POST',
      headers: { 'stripe-signature': signature },
      body,
    }), env);
    expect(verified.status).toBe(501);
    expect(verified.headers.get('X-Chief-Stripe-Signature-Verified')).toBe('true');
    await expect(verified.json()).resolves.toMatchObject({
      verified: true,
      error: 'event_processing_not_implemented',
    });
  });
});
