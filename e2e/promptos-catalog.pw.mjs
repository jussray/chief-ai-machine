import { test, expect } from '@playwright/test';

test('Chief keeps PromptOS outside its product surface', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  await expect(page).toHaveTitle('Chief AI Machine — Executive Intelligence Workspace');
  await expect(page.locator('#page-goals')).toBeAttached();
  await expect(page.locator('#page-brain')).toBeAttached();
  await expect(page.locator('#page-library')).toBeAttached();

  await expect(page.locator('[data-page="promptos"]')).toHaveCount(0);
  await expect(page.locator('#page-promptos')).toHaveCount(0);
  await expect(page.locator('#promptosDialog')).toHaveCount(0);
  await expect(page.locator('link[data-promptos-style]')).toHaveCount(0);
});
