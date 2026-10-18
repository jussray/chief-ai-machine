import { expect, test } from '@playwright/test';

const chiefSurfaces = [
  { role: 'public', origin: 'https://chief.foundercontrolroom.org' },
  { role: 'app', origin: 'https://app.chief.foundercontrolroom.org' },
  { role: 'api', origin: 'https://api.chief.foundercontrolroom.org' },
];

test('Chief custom domains deny anonymous browser requests; this is NOT runtime proof', async ({ page }) => {
  const observations = [];

  // Inspect all hosts even when one fails. A denial does not prove the
  // underlying Worker returned /version, nor does it prove authentication.
  for (const surface of chiefSurfaces) {
    const hostname = new URL(surface.origin).hostname;
    try {
      const response = await page.goto(surface.origin + '/version', {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });
      const finalHostname = new URL(page.url()).hostname;
      const headers = response?.headers() ?? {};
      observations.push({
        role: surface.role,
        hostname,
        finalHostname,
        status: response?.status() ?? 0,
        contentType: (headers['content-type'] || '').split(';')[0].slice(0, 80),
        cloudflareChallenge: headers['cf-mitigated'] === 'challenge',
        accessRedirect: finalHostname.endsWith('.cloudflareaccess.com'),
      });
    } catch (error) {
      observations.push({
        role: surface.role,
        hostname,
        status: 'navigation_error',
        reason: error instanceof Error ? error.name : 'unknown',
      });
    }
  }

  // These metadata fields cannot expose cookies, tokens, Access URLs or bodies.
  console.info('Chief anonymous-access observations:', JSON.stringify(observations));
  expect(observations).toHaveLength(chiefSurfaces.length);
  for (const observation of observations) {
    expect(observation.finalHostname, JSON.stringify(observation)).toBe(observation.hostname);
    expect(observation.status, JSON.stringify(observation)).toBe(403);
  }
  // No /version SHA is asserted: a 403 cannot establish deployed identity.
});
