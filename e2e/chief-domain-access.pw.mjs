import { expect, test } from '@playwright/test';

const chiefSurfaces = [
  { role: 'public', origin: 'https://chief.foundercontrolroom.org', path: '/', visibility: 'public' },
  { role: 'app', origin: 'https://app.chief.foundercontrolroom.org', path: '/version', visibility: 'private' },
  { role: 'api', origin: 'https://api.chief.foundercontrolroom.org', path: '/version', visibility: 'private' },
];

test('Chief public homepage stays reachable while private app and API remain protected', async ({ page }) => {
  const observations = [];
  for (const surface of chiefSurfaces) {
    const hostname = new URL(surface.origin).hostname;
    try {
      const response = await page.goto(surface.origin + surface.path, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      const finalHostname = new URL(page.url()).hostname;
      const headers = response?.headers() ?? {};
      observations.push({
        role: surface.role,
        visibility: surface.visibility,
        hostname,
        finalHostname,
        status: response?.status() ?? 0,
        cloudflareChallenge: headers['cf-mitigated'] === 'challenge',
        accessRedirect: finalHostname.endsWith('.cloudflareaccess.com'),
      });
    } catch {
      observations.push({
        role: surface.role,
        visibility: surface.visibility,
        hostname,
        status: 'navigation_error',
        cloudflareChallenge: false,
        accessRedirect: false,
      });
    }
  }

  // Metadata only; no cookies, URLs containing Access tokens, or response bodies.
  console.info('Chief access-boundary observations:', JSON.stringify(observations));
  expect(observations).toHaveLength(chiefSurfaces.length);
  const publicSurface = observations.find((x) => x.role === 'public');
  expect(publicSurface.accessRedirect).toBe(false);
  expect(publicSurface.cloudflareChallenge).toBe(false);
  expect(publicSurface.status).toBe(200);

  for (const observation of observations.filter((x) => x.visibility === 'private')) {
    const denied = observation.accessRedirect
      || observation.status === 401
      || observation.status === 403;
    expect(denied, JSON.stringify(observation)).toBe(true);
  }
  // Denial and public reachability do NOT prove the exact deployed Worker SHA.
});
