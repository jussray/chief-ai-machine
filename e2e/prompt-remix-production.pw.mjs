import { expect, test } from '@playwright/test';
import { chiefAccessHeaders, createChiefBoundRequest } from '../scripts/chief-proof-request.mjs';

const baseURL = String(process.env.CHIEF_PRODUCTION_BASE_URL || '').replace(/\/$/, '');
const expectedHead = String(process.env.EXPECTED_HEAD_SHA || '');

if (!baseURL) throw new Error('CHIEF_PRODUCTION_BASE_URL is required');
if (!/^[0-9a-f]{40}$/.test(expectedHead)) throw new Error('EXPECTED_HEAD_SHA must be an exact commit SHA');

test('production serves the exact Chief Prompt Remix build and usable Prompt Library', async ({ page, playwright }) => {
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
  } finally {
    await client.dispose();
  }

  const accessHeaders = chiefAccessHeaders(process.env, baseURL);
  // Set the service-token pair on the browser context before navigation.
  // Route interception can accidentally omit headers on the initial document request.
  await page.context().setExtraHTTPHeaders(accessHeaders);

  const navigation = await page.goto(`${baseURL}/app`, { waitUntil: 'domcontentloaded' });
  expect(navigation, 'Chief production app returned no browser response').not.toBeNull();
  expect(navigation.status(), 'Chief production app returned an HTTP error').toBe(200);
  expect(new URL(page.url()).origin).toBe(baseURL);
  await expect(page).toHaveTitle('Chief AI — Prompt Remix Studio');
  await expect(page.locator('#page-library')).toBeVisible();
  const promptCards = page.locator('#grid .pcard');
  await expect(promptCards.first()).toBeVisible();
  expect(await promptCards.count()).toBeGreaterThan(0);
  await expect(page.locator('#search')).toBeVisible();
});
