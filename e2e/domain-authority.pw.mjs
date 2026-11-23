import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { chiefAccessHeaders } from '../scripts/chief-proof-request.mjs';

const contract = JSON.parse(
  readFileSync(new URL('../config/domain-authority.json', import.meta.url), 'utf8'),
);
const wrangler = JSON.parse(
  readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
);
const frontDoor = JSON.parse(
  readFileSync(new URL('../wrangler.front-door.jsonc', import.meta.url), 'utf8'),
);

const standaloneOrigin = String(contract.canonicalOrigin || '').trim();
const fcrOrigin = String(contract.fcrIntegrationOrigin || '').trim();
const explicitOrigin = String(process.env.CHIEF_PUBLIC_ORIGIN || '').trim();
const expectedSha = String(process.env.DOMAIN_EXPECTED_SHA || '').trim();

const surfaces = [
  {
    name: 'standalone',
    origin: standaloneOrigin,
    publicTitle: 'Chief AI | Independent Founder Intelligence',
  },
  {
    name: 'fcr',
    origin: fcrOrigin,
    publicTitle: 'Founder Control Room | Chief Intelligence',
  },
];

test('Chief owns two hostname-specific surfaces on one Worker', () => {
  expect(contract.schemaVersion).toBe(2);
  expect(contract.project).toBe('chief-ai-machine');
  expect(contract.mode).toBe('dual-domain-single-worker');
  expect(contract.publicClaimAuthorized).toBe(false);
  expect(contract.worker?.name).toBe('chief-ai');
  expect(standaloneOrigin).toBe('https://chief.jussco.company');
  expect(fcrOrigin).toBe('https://chief.foundercontrolroom.org');
  expect(contract.surfaces.standalone).toMatchObject({
    role: 'standalone-product',
    publicRootWorker: 'chief-public-front-door',
    applicationWorker: 'chief-ai',
    independent: true,
  });
  expect(contract.surfaces.fcr).toMatchObject({
    role: 'fcr-branded-integration',
    publicRootWorker: 'chief-public-front-door',
    applicationWorker: 'chief-ai',
    independent: true,
  });

  expect(wrangler.name).toBe('chief-ai');
  expect(wrangler.workers_dev).toBe(false);
  expect(wrangler.preview_urls).toBe(true);
  expect(wrangler.assets?.run_worker_first).toBe(true);
  const customDomains = (wrangler.routes || []).filter((route) => route?.custom_domain === true);
  expect(customDomains).toEqual([
    { pattern: 'chief.jussco.company', custom_domain: true },
    { pattern: 'chief.foundercontrolroom.org', custom_domain: true },
  ]);

  expect(frontDoor.routes.map(route => route.pattern)).toEqual([
    'chief.jussco.company/',
    'chief.foundercontrolroom.org/',
    'chief.foundercontrolroom.org/__frontdoor_home*',
  ]);
  expect(contract.providerPolicy).toMatchObject({
    productionWorkersDev: false,
    previewUrls: true,
    providerPreviewIsCanonical: false,
    oneSharedChiefWorker: true,
    publicFrontDoorsAreHostSpecific: true,
    privateApplicationUsesWorkerLevelAccess: true,
  });
});

const remoteTest = explicitOrigin ? test : test.skip;
remoteTest('both public roots and protected app/API resolve to the same exact Chief Worker', async ({ page, request }) => {
  expect(explicitOrigin).toBe(standaloneOrigin);

  for (const surface of surfaces) {
    const publicResponse = await page.goto(surface.origin, { waitUntil: 'domcontentloaded' });
    expect(publicResponse, `${surface.origin} public root returned no browser response`).not.toBeNull();
    expect(publicResponse.status(), `${surface.origin} public root returned an error`).toBe(200);
    expect(new URL(page.url()).origin).toBe(surface.origin);
    await expect(page).toHaveTitle(surface.publicTitle);

    const accessHeaders = chiefAccessHeaders(process.env, surface.origin);
    const versionUrl = new URL(contract.worker.versionPath || '/version', surface.origin).toString();
    const versionResponse = await request.get(versionUrl, {
      headers: { Accept: 'application/json', ...accessHeaders },
      maxRedirects: 0,
    });
    expect(versionResponse.ok(), `${versionUrl} returned ${versionResponse.status()}`).toBeTruthy();
    expect(versionResponse.headers()['content-type'] || '').toContain('application/json');
    const payload = await versionResponse.json();
    expect(payload).toMatchObject({ ok: true });
    expect(payload.sha).toMatch(/^[0-9a-f]{40}$/);

    if (expectedSha) {
      expect(expectedSha).toMatch(/^[0-9a-f]{40}$/);
      expect(payload.sha).toBe(expectedSha);
    }

    const appPage = await page.context().newPage();
    await appPage.route('**/*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.origin === surface.origin) {
        await route.continue({ headers: { ...route.request().headers(), ...accessHeaders } });
      } else {
        await route.continue();
      }
    });
    const appResponse = await appPage.goto(`${surface.origin}/app`, { waitUntil: 'domcontentloaded' });
    expect(appResponse, `${surface.origin}/app returned no browser response`).not.toBeNull();
    expect(appResponse.status(), `${surface.origin}/app returned an error`).toBeLessThan(400);
    await expect(appPage).toHaveTitle('Chief AI — Prompt Remix Studio');
    await appPage.close();
  }
});
