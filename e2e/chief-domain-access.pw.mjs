import { expect, test } from '@playwright/test';

const publicSurfaces = [
  { role: 'standalone', origin: 'https://chief.jussco.company', title: 'Chief AI | Independent Founder Intelligence' },
  { role: 'fcr', origin: 'https://chief.foundercontrolroom.org', title: 'Founder Control Room | Chief Intelligence' },
];
const protectedPaths = ['/app', '/api/chief/provider'];

test('both Chief public front doors are anonymous and host-specific', async ({ page }) => {
  for (const surface of publicSurfaces) {
    const response = await page.goto(surface.origin, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    expect(response, JSON.stringify(surface)).not.toBeNull();
    expect(response.status(), JSON.stringify(surface)).toBe(200);
    expect(new URL(page.url()).origin).toBe(surface.origin);
    await expect(page).toHaveTitle(surface.title);
  }
});

test('both Chief application hosts keep app and API paths behind Worker Access', async ({ page }) => {
  const observations = [];
  for (const surface of publicSurfaces) {
    for (const path of protectedPaths) {
      try {
        const response = await page.goto(surface.origin + path, {
          waitUntil: 'domcontentloaded',
          timeout: 30_000,
        });
        const finalHostname = new URL(page.url()).hostname;
        observations.push({
          role: surface.role,
          path,
          finalHostname,
          status: response?.status() ?? 0,
          accessRedirect: finalHostname.endsWith('.cloudflareaccess.com'),
        });
      } catch (error) {
        observations.push({
          role: surface.role,
          path,
          status: 'navigation_error',
          reason: error instanceof Error ? error.name : 'unknown',
        });
      }
    }
  }
  console.info('Chief anonymous-access observations:', JSON.stringify(observations));
  expect(observations).toHaveLength(publicSurfaces.length * protectedPaths.length);
  for (const observation of observations) {
    expect(observation.status, JSON.stringify(observation)).toBe(403);
  }
});
