import { expect, test } from '@playwright/test';

const chiefSurfaces = [
  { role: 'public', origin: 'https://chief.foundercontrolroom.org' },
  { role: 'app', origin: 'https://app.chief.foundercontrolroom.org' },
  { role: 'api', origin: 'https://api.chief.foundercontrolroom.org' },
];

test('Chief public, app, and api hostnames resolve to one deployed Worker identity', async ({ page }) => {
  const observed = [];

  for (const surface of chiefSurfaces) {
    const response = await page.goto(`${surface.origin}/version`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    });

    expect(response).not.toBeNull();
    expect(response.status()).toBe(200);

    const finalUrl = new URL(page.url());
    expect(finalUrl.hostname).toBe(new URL(surface.origin).hostname);
    expect(response.headers()['content-type'] || '').toContain('application/json');

    const payload = await response.json();
    expect(payload?.ok).toBe(true);
    expect(payload?.sha).toMatch(/^[0-9a-f]{40}$/);

    observed.push({
      role: surface.role,
      hostname: finalUrl.hostname,
      sha: payload.sha,
    });
  }

  expect(new Set(observed.map((entry) => entry.sha)).size).toBe(1);
});
