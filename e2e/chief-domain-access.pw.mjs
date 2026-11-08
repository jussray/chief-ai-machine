import { expect, test } from '@playwright/test';

const chiefSurfaces = [
  { role: 'public', origin: 'https://chief.foundercontrolroom.org', path: '/', visibility: 'public' },
  { role: 'app', origin: 'https://app.chief.foundercontrolroom.org', path: '/version', visibility: 'private' },
  { role: 'api', origin: 'https://api.chief.foundercontrolroom.org', path: '/version', visibility: 'private' },
];

// A generic Cloudflare bot challenge is not proof that an unauthenticated
// visitor is denied by the app/API authorization boundary.
export function verifiedPrivateDenial(observation) {
  if (observation.cloudflareChallenge) return false;
  return observation.accessRedirect === true
    || observation.status === 401
    || observation.status === 403;
}

test('Cloudflare bot challenge cannot satisfy the private Access proof', () => {
  expect(verifiedPrivateDenial({ accessRedirect: false, status: 403, cloudflareChallenge: true })).toBe(false);
  expect(verifiedPrivateDenial({ accessRedirect: true, status: 302, cloudflareChallenge: false })).toBe(true);
  expect(verifiedPrivateDenial({ accessRedirect: false, status: 401, cloudflareChallenge: false })).toBe(true);
  expect(verifiedPrivateDenial({ accessRedirect: false, status: 200, cloudflareChallenge: false })).toBe(false);
});

// Cloudflare Ray IDs are public trace identifiers, not credentials. Reject
// arbitrary header content so CI cannot print unexpected or sensitive values.
export function safeCloudflareRayId(headers) {
  const raw = headers?.['cf-ray'];
  return typeof raw === 'string' && /^[a-f0-9]{16}-[A-Za-z0-9]{2,8}$/.test(raw) ? raw : null;
}

test('Cloudflare Ray ID diagnostics are bounded and reject unexpected headers', () => {
  expect(safeCloudflareRayId({ 'cf-ray': 'a570e8168c83a201-MSP' })).toBe('a570e8168c83a201-MSP');
  expect(safeCloudflareRayId({ 'cf-ray': 'token\nAuthorization: secret' })).toBeNull();
  expect(safeCloudflareRayId({ 'cf-ray': '' })).toBeNull();
});

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
        cfRay: safeCloudflareRayId(headers),
        accessRedirect: finalHostname.endsWith('.cloudflareaccess.com'),
      });
    } catch {
      observations.push({
        role: surface.role,
        visibility: surface.visibility,
        hostname,
        status: 'navigation_error',
        cloudflareChallenge: false,
        cfRay: null,
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
    const denied = verifiedPrivateDenial(observation);
    expect(denied, JSON.stringify(observation)).toBe(true);
  }
  // Denial and public reachability do NOT prove the exact deployed Worker SHA.
});
