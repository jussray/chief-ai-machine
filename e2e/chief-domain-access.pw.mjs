import { expect, test } from '@playwright/test';

const chiefSurfaces = [
  'https://chief.foundercontrolroom.org',
  'https://app.chief.foundercontrolroom.org',
  'https://api.chief.foundercontrolroom.org',
];

test('all Chief public surfaces remain behind the same Cloudflare Access boundary', async ({ page }) => {
  const observed = [];

  for (const origin of chiefSurfaces) {
    const response = await page.goto(`${origin}/version`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    expect(response).not.toBeNull();

    const finalUrl = new URL(page.url());
    const direct = finalUrl.hostname === new URL(origin).hostname;

    if (direct) {
      throw new Error(
        `${origin} reached Chief directly without Cloudflare Access interception; refusing a domain-alias false green`,
      );
    }

    expect(finalUrl.hostname.endsWith('.cloudflareaccess.com')).toBe(true);

    observed.push({
      origin,
      finalHost: finalUrl.hostname,
      status: response.status(),
    });
  }

  const finalHosts = new Set(observed.map((entry) => entry.finalHost));
  expect(finalHosts.size).toBe(1);
});
