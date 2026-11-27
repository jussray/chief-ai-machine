/* global document */
import { expect, test } from '@playwright/test';

test('living workspace preserves the real goal flow and allows motion to be paused', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-page="goals"]:visible').first().click();
  await expect(page.getByRole('heading', { name: 'What are we trying to accomplish?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kael', exact: true })).toBeVisible();
  await expect(page.locator('#chief-specialist-presence')).toContainText('Live character connection pending');
  const cloud = page.locator('.chief-cloud-a');
  await expect(cloud).toHaveCSS('animation-name', 'chief-cloud-drift');
  const pause = page.getByRole('checkbox', { name: 'Pause scenery motion' });
  await pause.check();
  await expect(cloud).toHaveCSS('animation-play-state', 'paused');
  await pause.uncheck();
  await expect(cloud).toHaveCSS('animation-play-state', 'running');
  await expect(page.locator('#goalForm [name="goal"]')).toBeEditable();
  await page.locator('[data-page="brain"]:visible').first().click();
  await expect(page.locator('#page-brain')).toBeVisible();
  await expect(pause).toBeVisible();
  await expect(page.locator('[data-page="goals"]:visible').first()).toBeVisible();
  await page.locator('[data-page="goals"]:visible').first().click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});

test('system reduced-motion preference overrides scenery motion and responsive layout fits landscape', async ({ page }) => {
  await page.setViewportSize({ width: 693, height: 320 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/app.html', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-page="goals"]:visible').first().click();
  await expect(page.locator('.chief-cloud-a')).toHaveCSS('animation-name', 'none');
  await expect(page.locator('#chief-specialist-presence')).toBeVisible();
  await expect(page.locator('#goalForm [name="goal"]')).toBeEditable();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
});
