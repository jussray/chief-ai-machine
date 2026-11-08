import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const contract = JSON.parse(
  readFileSync(new URL('../config/domain-authority.json', import.meta.url), 'utf8'),
);
const wrangler = JSON.parse(
  readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'),
);

const canonicalOrigin = String(contract.canonicalOrigin || '').trim();
const explicitOrigin = String(process.env.CHIEF_PUBLIC_ORIGIN || '').trim();
const expectedSha = String(process.env.DOMAIN_EXPECTED_SHA || '').trim();

test('Chief production target is one committed custom domain', () => {
  expect(contract.schemaVersion).toBe(1);
  expect(contract.project).toBe('chief-ai-machine');
  expect(contract.mode).toBe('production-target');
  expect(contract.publicClaimAuthorized).toBe(false);
  expect(contract.worker?.name).toBe('chief-ai');
  expect(canonicalOrigin).toBe('https://chief.foundercontrolroom.org');
  expect(canonicalOrigin).not.toContain('.workers.dev');

  expect(wrangler.name).toBe('chief-ai');
  expect(wrangler.workers_dev).toBe(false);
  expect(wrangler.preview_urls).toBe(true);
  expect(wrangler.assets?.run_worker_first).toBe(true);

  const customRoutes = (wrangler.routes || []).filter((route) => route?.custom_domain === true);
  expect(customRoutes).toEqual([
    { pattern: 'chief.foundercontrolroom.org', custom_domain: true },
  ]);

  const canonical = new URL(canonicalOrigin);
  expect(canonical.protocol).toBe('https:');
  expect(canonical.hostname).toBe(customRoutes[0].pattern);
  expect(canonical.pathname).toBe('/');
  expect(contract.providerPolicy).toEqual({
    productionWorkersDev: false,
    previewUrls: true,
    providerPreviewIsCanonical: false,
  });
});

const remoteTest = explicitOrigin ? test : test.skip;
remoteTest('explicit canonical Chief origin serves UI and exact Worker identity', async ({ page, request }) => {
  expect(explicitOrigin).toBe(canonicalOrigin);

  const navigation = await page.goto(explicitOrigin, { waitUntil: 'domcontentloaded' });
  expect(navigation, `${explicitOrigin} returned no browser response`).not.toBeNull();
  expect(navigation.status(), `${explicitOrigin} returned a server error`).toBeLessThan(500);
  expect(new URL(page.url()).origin).toBe(new URL(canonicalOrigin).origin);
  await expect(page).toHaveTitle('Chief AI — Founder Intelligence OS');

  const versionUrl = new URL(contract.worker.versionPath || '/version', canonicalOrigin).toString();
  const versionResponse = await request.get(versionUrl, {
    headers: { Accept: 'application/json' },
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
});
