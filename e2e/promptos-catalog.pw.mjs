import { test, expect } from '@playwright/test';

test('PromptOS stays lazy, filters 5K recipes, and compiles concrete founder context', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.promptos-card')).toHaveCount(0);
  await expect(page.locator('#promptosResultCount')).toHaveText('Catalog loads when opened');

  await page.locator('[data-page="promptos"]:visible').click();

  await expect(page.locator('#page-promptos')).toHaveClass(/on/);
  await expect(page.locator('#promptosTotal')).toHaveText('5,000');
  await expect(page.locator('#promptosCandidateTotal')).toHaveText('5,400');
  await expect(page.locator('.promptos-card')).toHaveCount(24);

  await page.locator('#promptosFamily').selectOption('repo.audit.first');
  await expect(page.locator('#promptosResultCount')).toContainText('1,0');

  await page.locator('.promptos-card').first().click();
  await expect(page.locator('#promptosDialog')).toBeVisible();

  const values = {
    repoName: 'chief-ai-machine',
    branchOrPr: 'fix/promptos-catalog-runtime',
    commitHead: 'test-head-sha',
    stack: 'native ESM + Vitest',
    goal: 'Ship the smallest verified PromptOS runtime slice',
  };

  for (const [key, value] of Object.entries(values)) {
    await page.locator(`[data-promptos-input="${key}"]`).fill(value);
  }

  await page.locator('#promptosCompile').click();
  await expect(page.locator('#promptosReadiness')).toContainText('Ready to copy');
  await expect(page.locator('#promptosCopy')).toBeEnabled();
  for (const value of Object.values(values)) {
    await expect(page.locator('#promptosOutput')).toContainText(value);
  }
});

test('PromptOS catalog does not starve compliance recipes', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-page="promptos"]:visible').click();
  await page.locator('#promptosFamily').selectOption('compliance.and.security.sentinel');
  await expect(page.locator('#promptosResultCount')).toContainText('493 recipes');
});
