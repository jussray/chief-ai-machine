/* global window, document */
import { test, expect } from '@playwright/test';

// Founder-approved visual identity. No fake runtime counts or external execution
// authority is asserted here. Actual provider proof has a separate live test.
test('Chief approved desktop home retains artwork and working navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#page-goals.on .brand-hero h1')).toHaveText('CHIEF');
  await expect(page.locator('#page-goals.on .brand-hero-image')).toBeVisible();

  const image = await page.request.get('/assets/brand/approved-chief-lion.webp');
  expect(image.status()).toBe(200);
  expect(image.headers()['content-type']).toMatch(/image\/webp/);

  await page.locator('.brand-shortcuts [data-page="brain"]').click();
  await expect(page.locator('#page-brain.on')).toBeVisible();
  await page.locator('.brand-top-nav [data-page="goals"]').click();
  await expect(page.locator('#page-goals.on #goalForm')).toBeVisible();
});

test('Chief mobile home reflows without clipping and preserves goal action', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#page-goals.on .brand-hero')).toBeVisible();
  await expect(page.locator('.mobile-nav [data-page="goals"]')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole('link', { name: 'Start a bounded founder goal' }).click();
  await expect(page.locator('#goalForm')).toBeVisible();
});
