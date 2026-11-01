/* global document */

import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

const baseURL = process.env.CHIEF_SECURITY_BASE_URL;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

if (!baseURL) throw new Error('CHIEF_SECURITY_BASE_URL is required');
if (!stripeWebhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is required');

function stripeSignature(body, timestamp) {
  const digest = createHmac('sha256', stripeWebhookSecret)
    .update(String(timestamp) + '.' + body)
    .digest('hex');
  return 't=' + timestamp + ',v1=' + digest;
}

test.describe('Gate 3: CSP report-only runtime proof', () => {
  test('HTML and API responses carry the expected security headers', async ({ request }) => {
    for (const path of ['/', '/version']) {
      const response = await request.get(baseURL + path);
      expect(response.status()).toBe(200);
      const headers = response.headers();
      const csp = headers['content-security-policy-report-only'];
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src 'self' 'nonce-");
      const nonceMatch = csp.match(/'nonce-([a-f0-9]+)'/);
      expect(nonceMatch?.[1]).toHaveLength(32);
      expect(headers['x-content-type-options']).toBe('nosniff');
      expect(headers['x-frame-options']).toBe('DENY');
      expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    }
  });

  test('nonce-less inline script is reported but still executes in report-only mode', async ({ page }) => {
    await page.addInitScript(() => {
      globalThis.__chiefCspViolationObserved = false;
      document.addEventListener('securitypolicyviolation', (event) => {
        if (event.disposition === 'report' && event.effectiveDirective.startsWith('script-src')) {
          globalThis.__chiefCspViolationObserved = true;
        }
      });
    });

    await page.goto(baseURL + '/');
    await page.addScriptTag({ content: 'globalThis.__chiefInlineProbeRan = true;' });
    await expect.poll(() => page.evaluate(() => globalThis.__chiefInlineProbeRan)).toBe(true);
    await expect.poll(() => page.evaluate(() => globalThis.__chiefCspViolationObserved)).toBe(true);
  });
});

test.describe('Gate 4: Stripe HMAC runtime proof', () => {
  const body = JSON.stringify({ id: 'evt_test', type: 'payment_intent.succeeded' });

  test('unsigned and invalid signatures are rejected', async ({ request }) => {
    const unsigned = await request.post(baseURL + '/api/stripe-webhook', { data: body });
    expect(unsigned.status()).toBe(401);

    const timestamp = Math.floor(Date.now() / 1000);
    const invalid = await request.post(baseURL + '/api/stripe-webhook', {
      headers: { 'stripe-signature': 't=' + timestamp + ',v1=' + '0'.repeat(64) },
      data: body,
    });
    expect(invalid.status()).toBe(401);
  });

  test('valid current HMAC is verified without falsely acknowledging event processing', async ({ request }) => {
    const timestamp = Math.floor(Date.now() / 1000);
    const response = await request.post(baseURL + '/api/stripe-webhook', {
      headers: { 'stripe-signature': stripeSignature(body, timestamp) },
      data: body,
    });

    expect(response.status()).toBe(501);
    expect(response.headers()['x-chief-stripe-signature-verified']).toBe('true');
    await expect(response.json()).resolves.toMatchObject({
      verified: true,
      error: 'event_processing_not_implemented',
    });
  });

  test('correctly signed stale payload is rejected as replay risk', async ({ request }) => {
    const staleTimestamp = Math.floor(Date.now() / 1000) - 301;
    const response = await request.post(baseURL + '/api/stripe-webhook', {
      headers: { 'stripe-signature': stripeSignature(body, staleTimestamp) },
      data: body,
    });
    expect(response.status()).toBe(401);
  });
});
