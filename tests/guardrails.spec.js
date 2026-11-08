import { test, expect } from '@playwright/test';

const APPROVED_EXTERNAL_ORIGINS = new Set([
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
]);

test('declares prototype vision and active guardrails', async ({ page }) => {
  const disallowedExternalRequests = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.origin !== 'http://127.0.0.1:4173' && !APPROVED_EXTERNAL_ORIGINS.has(url.origin)) {
      disallowedExternalRequests.push(request.url());
    }
  });

  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-guardrails', 'active');
  await expect(page.locator('html')).toHaveAttribute('data-product-stage', 'prototype');
  await expect(page.locator('#guardrailStatus')).toHaveText('Prototype guardrails active');

  const snapshot = await page.evaluate(() => window.__CHIEF_AI_GUARDRAILS__);
  expect(snapshot.vision.stage).toBe('prototype');
  expect(snapshot.stateScope).toBe('browser-local');
  expect(snapshot.privilegedActions).toBe(false);
  expect(snapshot.guardrails.map(item => item.id)).toEqual(expect.arrayContaining([
    'CHIEF-TRUTH-001',
    'CHIEF-SECRET-001',
    'CHIEF-IMPORT-001',
    'CHIEF-APPROVAL-001'
  ]));
  expect(disallowedExternalRequests).toEqual([]);
});

test('rejects unsafe imported state before persistence', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { validateChiefImportPayload } = await import('/src/config/visionGuardrails.js');
    const outcomes = [];
    for (const value of [
      null,
      { custom: {}, stars: [] },
      { custom: [], stars: 'all' },
      { custom: Array.from({ length: 501 }, () => ({ title: 'x', body: 'y' })), stars: [] }
    ]) {
      try {
        validateChiefImportPayload(value, 0);
        outcomes.push('accepted');
      } catch (error) {
        outcomes.push(error instanceof Error ? error.message : 'rejected');
      }
    }
    return outcomes;
  });

  expect(result.every(value => value !== 'accepted')).toBe(true);
});

test('does not expose privileged actions or obvious secret material', async ({ page }) => {
  await page.goto('/');
  const text = await page.locator('body').innerText();
  expect(text).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|sk-[A-Za-z0-9_-]{10,}/i);
  await expect(page.getByRole('button', { name: /deploy|merge|rotate secret|change billing/i })).toHaveCount(0);
});
