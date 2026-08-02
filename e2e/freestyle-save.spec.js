import { test, expect } from '@playwright/test';

const REQUIRED_MARKERS = [
  'authoritative repository',
  'VERIFIED',
  'INFERRED',
  'UNKNOWN',
  'BLOCKED',
];

test('Freestyle saves evidence-first versions for every selected provider', async ({ page }) => {
  await page.goto('/');

  await page.locator('[data-page="freestyle"]').first().click();
  await expect(page.locator('#page-freestyle')).toHaveClass(/\bon\b/);

  await page.locator('#fsAsk').fill(
    'Audit the repository, separate evidence from inference, and recommend the smallest reversible fix.',
  );
  await page.locator('#fsGenerate').click();
  await expect(page.locator('#fsPreview')).toHaveClass(/\bon\b/);
  await expect(page.locator('#fsBody')).not.toBeEmpty();

  await page.locator('#fsSave').click();

  const saved = await page.evaluate(() => {
    const drafts = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    return drafts.at(-1) || null;
  });

  expect(saved).not.toBeNull();
  expect(Object.keys(saved.versions)).toEqual(
    expect.arrayContaining(['chatgpt', 'claude', 'perplexity']),
  );

  for (const [platform, text] of Object.entries(saved.versions)) {
    expect(typeof text, `${platform} saved version must be text`).toBe('string');
    for (const marker of REQUIRED_MARKERS) {
      expect(text, `${platform} saved version must contain ${marker}`).toContain(marker);
    }
  }
});
