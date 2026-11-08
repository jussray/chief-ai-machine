import { test, expect } from '@playwright/test';

const immutableChiefOrigin = /^https:\/\/[0-9a-f]{8}-chief-ai\.mcgill-raylene\.workers\.dev$/;

test('founder-authenticated immutable Chief preview proves SHA, SPA, and CSS', async ({ page }) => {
  const origin = process.env.CHIEF_PREVIEW_ORIGIN;
  const expectedSha = process.env.EXPECTED_HEAD_SHA;
  const accessClientId = process.env.CLOUDFLARE_ACCESS_CLIENT_ID;
  const accessClientSecret = process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET;
  expect(origin).toMatch(immutableChiefOrigin);
  expect(expectedSha).toMatch(/^[0-9a-f]{40}$/);
  expect(accessClientId).toBeTruthy();
  expect(accessClientSecret).toBeTruthy();

  // Route only to the admitted preview origin, never forward authentication
  // to third-party hosts or Cloudflare Access login redirects.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const u = new URL(request.url());
    if (u.origin !== origin) {
      await route.abort();
      return;
    }
    const response = await route.fetch({
      headers: {
        ...request.headers(),
        'CF-Access-Client-Id': accessClientId,
        'CF-Access-Client-Secret': accessClientSecret,
      },
      maxRedirects: 0,
    });
    await route.fulfill({ response });
  });

  const version = await page.goto(origin + '/version', { waitUntil: 'domcontentloaded' });
  expect(version).not.toBeNull();
  expect(version.status()).toBe(200);
  expect(new URL(page.url()).origin).toBe(origin);
  expect(version.headers()['content-type'] || '').toContain('application/json');
  const payload = await version.json();
  expect(payload?.sha).toBe(expectedSha);

  const app = await page.goto(origin + '/', { waitUntil: 'domcontentloaded' });
  expect(app).not.toBeNull();
  expect(app.status()).toBe(200);
  expect(new URL(page.url()).origin).toBe(origin);
  await expect(page.locator('#app')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What are we trying to accomplish?' })).toBeVisible();

  const css = await page.goto(origin + '/styles/main.css', { waitUntil: 'domcontentloaded' });
  expect(css).not.toBeNull();
  expect(css.status()).toBe(200);
  expect(new URL(page.url()).origin).toBe(origin);
  expect(css.headers()['content-type'] || '').toContain('text/css');
  expect((await css.text()).length).toBeGreaterThan(100);
});
