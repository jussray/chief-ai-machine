/* global document */

import { createHmac } from 'node:crypto';
import { expect, test } from '@playwright/test';

const baseURL = process.env.CHIEF_SECURITY_BASE_URL;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

test.describe('Chief operator-only OpenAI boundary', () => {
  test('public requests cannot inspect or invoke the provider', async ({ request }) => {
    for (const method of ['get', 'post']) {
      const response = await request[method](baseURL + '/api/chief/provider', { data: {} });
      expect(response.status()).toBe(401);
      expect(response.headers()['cache-control']).toBe('no-store');
    }
  });
  test('Protect Me 2 pilot requires a server-owned test identity before any provider call', async ({ request }) => {
    const response = await request.post(baseURL + '/api/chief/provider', {
      headers: { Authorization: 'Bearer chief-provider-playwright-fixture' },
      data: { prompt: 'Synthetic public pilot probe.', sensitivity: 'public' },
    });
    expect(response.status()).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: 'protect2_pilot_not_configured' });
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['cache-control']).toBe('no-store');
  });

  test('operator configuration and rejected inputs traverse the real Worker without inference', async ({ request }) => {
    const headers = { Authorization: 'Bearer chief-provider-playwright-fixture' };
    const status = await request.get(baseURL + '/api/chief/provider', { headers });
    expect(status.status()).toBe(200);
    expect(await status.json()).toMatchObject({ service: 'chief-ai', provider: 'openai', state: 'INTEGRATED', authority: 'none' });
    const denied = await request.post(baseURL + '/api/chief/provider', {
      headers, data: { prompt: 'Synthetic restricted-context probe.', sensitivity: 'restricted' },
    });
    expect(denied.status()).toBe(400);
    expect(await denied.text()).not.toContain('synthetic-provider-fixture');
  });
});

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

// This Worker deliberately has no Stripe webhook handler. JussPay owns billing;
// a valid Stripe signature must not activate an unrelated Chief endpoint.
test.describe('Gate 4: legacy Stripe webhook remains unavailable', () => {
  const body = JSON.stringify({ id: 'evt_test', type: 'payment_intent.succeeded' });

  async function expectRetiredWebhook(response) {
    expect(response.status()).toBe(501);
    expect(await response.text()).toBe('Not implemented');
    expect(response.headers()['x-chief-stripe-signature-verified']).toBeUndefined();
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
  }

  test('unsigned and incorrectly signed webhook requests are never accepted', async ({ request }) => {
    await expectRetiredWebhook(await request.post(baseURL + '/api/stripe-webhook', { data: body }));
    await expectRetiredWebhook(await request.post(baseURL + '/api/stripe-webhook', {
      headers: { 'stripe-signature': 't=' + Math.floor(Date.now() / 1000) + ',v1=' + '0'.repeat(64) },
      data: body,
    }));
  });

  test('even a valid test signature cannot create a Chief billing acknowledgment', async ({ request }) => {
    const timestamp = Math.floor(Date.now() / 1000);
    await expectRetiredWebhook(await request.post(baseURL + '/api/stripe-webhook', {
      headers: { 'stripe-signature': stripeSignature(body, timestamp) },
      data: body,
    }));
  });

  test('a stale signature also cannot revive the retired webhook', async ({ request }) => {
    const timestamp = Math.floor(Date.now() / 1000) - 301;
    await expectRetiredWebhook(await request.post(baseURL + '/api/stripe-webhook', {
      headers: { 'stripe-signature': stripeSignature(body, timestamp) },
      data: body,
    }));
  });
});
