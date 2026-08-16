/* global process */
import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const contract = JSON.parse(
  readFileSync(new URL('../config/domain-authority.json', import.meta.url), 'utf8'),
);

const explicitOrigin = (process.env.CHIEF_PUBLIC_ORIGIN || contract.canonicalOrigin || '').trim();

test('Chief does not invent a production domain', () => {
  expect(contract.schemaVersion).toBe(1);
  expect(contract.project).toBe('chief-ai-machine');
  expect(contract.worker?.name).toBe('chief-ai');

  if (contract.mode === 'production') {
    expect(contract.canonicalOrigin, 'production mode requires a committed canonicalOrigin').toMatch(/^https:\/\//);
  } else {
    expect(contract.mode).toBe('production-pending-domain');
    expect(contract.canonicalOrigin).toBeNull();
  }
});

test('explicit Chief production origin serves UI and exact runtime identity', async ({ page, request }) => {
  test.skip(!explicitOrigin, 'No canonical Chief production origin has been chosen yet.');

  const navigation = await page.goto(explicitOrigin, { waitUntil: 'domcontentloaded' });
  expect(navigation, `${explicitOrigin} returned no browser response`).not.toBeNull();
  expect(navigation.status(), `${explicitOrigin} returned a server error`).toBeLessThan(500);
  expect(new URL(page.url()).origin).toBe(new URL(explicitOrigin).origin);

  const versionUrl = new URL(contract.worker.versionPath || '/version', explicitOrigin).toString();
  const versionResponse = await request.get(versionUrl);
  expect(versionResponse.ok(), `${versionUrl} returned ${versionResponse.status()}`).toBeTruthy();

  const payload = await versionResponse.text();
  expect(payload.trim().length).toBeGreaterThan(0);

  const expectedSha = process.env.DOMAIN_EXPECTED_SHA?.trim();
  if (expectedSha) {
    expect(payload, `${versionUrl} is not serving the expected exact SHA`).toContain(expectedSha);
  }
});
