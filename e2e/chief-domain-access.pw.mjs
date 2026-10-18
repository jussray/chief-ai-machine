import { expect, test } from '@playwright/test';

const chiefSurfaces = [
  { role: 'public', origin: 'https://chief.foundercontrolroom.org' },
  { role: 'app', origin: 'https://app.chief.foundercontrolroom.org' },
  { role: 'api', origin: 'https://api.chief.foundercontrolroom.org' },
];

test('Chief public, app, and api hostnames are live but fail closed before authentication', async ({ page }) => {
  const observed = [];

  for (const surface of chiefSurfaces) {
    const response = await page.goto(`${surface.origin}/version`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    expect(response).not.toBeNull();
    expect(response.status()).toBe(403);

    const finalUrl = new URL(page.url());
    expect(finalUrl.hostname).toBe(new URL(surface.origin).hostname);

    observed.push({
      role: surface.role,
      hostname: finalUrl.hostname,
      status: response.status(),
    });
  }

  expect(observed.map((entry) => entry.status)).toEqual([403, 403, 403]);
});
