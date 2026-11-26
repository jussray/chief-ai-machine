import { expect, test } from '@playwright/test';
import { chiefAccessHeaders, createChiefBoundRequest } from '../scripts/chief-proof-request.mjs';

const baseURL = String(process.env.CHIEF_PRODUCTION_BASE_URL || '').replace(/\/$/, '');
const expectedHead = String(process.env.EXPECTED_HEAD_SHA || '');

if (!baseURL) throw new Error('CHIEF_PRODUCTION_BASE_URL is required');
if (!/^[0-9a-f]{40}$/.test(expectedHead)) throw new Error('EXPECTED_HEAD_SHA must be an exact commit SHA');

test('production serves the exact Chief executive-intelligence workspace', async ({ page, playwright }) => {
  const client = await playwright.request.newContext({
    extraHTTPHeaders: chiefAccessHeaders(process.env, baseURL),
  });
  try {
    const request = createChiefBoundRequest(client, baseURL);
    const versionResponse = await request.get(`${baseURL}/version`, {
      headers: { Accept: 'application/json' },
    });
    expect(versionResponse.status()).toBe(200);
    const version = await versionResponse.json();
    expect(version).toMatchObject({ ok: true, sha: expectedHead });
    expect(version.version_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    let appStatus = null;
    for (const path of ['/app', '/app.html', '/index.html']) {
      const response = await client.get(`${baseURL}${path}`, { maxRedirects: 0 });
      const body = await response.text();
      console.log('Chief production asset diagnostic', JSON.stringify({
        path,
        status: response.status(),
        contentType: response.headers()['content-type'] || null,
        server: response.headers()['server'] || null,
        cfRay: response.headers()['cf-ray'] || null,
        location: response.headers()['location'] || null,
        bodyPrefix: body.slice(0, 160),
      }));
      if (path === '/app') appStatus = response.status();
    }
    expect(appStatus, 'Chief /app API request must succeed with the same Access service token as /version').toBe(200);
    const guardrailAsset = await client.get(`${baseURL}/src/config/visionGuardrails.js`, { maxRedirects: 0 });
    expect(guardrailAsset.status()).toBe(200);
    expect(guardrailAsset.headers()['content-type']).toMatch(/javascript/);
  } finally {
    await client.dispose();
  }

  // Cloudflare Bot Management challenges headless Chromium in CI. Fetch each
  // same-origin production resource through the authenticated API context, then
  // let Chromium render and exercise those exact production bytes. No WAF rule
  // or production security setting is weakened for automation.
  const browserAssetClient = await playwright.request.newContext({
    extraHTTPHeaders: chiefAccessHeaders(process.env, baseURL),
  });
  try {
    await page.route('**/*', async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      if (requestUrl.origin !== baseURL || request.method() !== 'GET') {
        await route.continue();
        return;
      }
      const upstream = await browserAssetClient.get(requestUrl.href, { maxRedirects: 0 });
      await route.fulfill({
        status: upstream.status(),
        headers: {
          'content-type': upstream.headers()['content-type'] || 'application/octet-stream',
          ...(upstream.headers()['cache-control'] ? { 'cache-control': upstream.headers()['cache-control'] } : {}),
        },
        body: await upstream.body(),
      });
    });

    const navigation = await page.goto(`${baseURL}/app`, { waitUntil: 'domcontentloaded' });
    expect(navigation, 'Chief production app returned no browser response').not.toBeNull();
    expect(navigation.status(), 'Chief production app returned an HTTP error').toBe(200);
    await page.waitForLoadState('networkidle');
  expect(new URL(page.url()).origin).toBe(baseURL);
  await expect(page).toHaveTitle('Chief AI Machine — Executive Intelligence Workspace');
  await expect(page.locator('#page-goals')).toBeAttached();
  await expect(page.locator('#page-brain')).toBeAttached();
  await expect(page.locator('[data-page="promptos"]')).toHaveCount(0);
  await expect(page.locator('#page-promptos')).toHaveCount(0);
  await expect(page.locator('#page-library')).toBeVisible();
  await expect(page.locator('[data-testid="guardrail-status"]')).toBeAttached();
  const promptCards = page.locator('#grid .pcard');
  await expect(promptCards.first()).toBeVisible();
  expect(await promptCards.count()).toBeGreaterThan(0);
    await expect(page.locator('#search')).toBeVisible();
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await browserAssetClient.dispose();
  }
});
