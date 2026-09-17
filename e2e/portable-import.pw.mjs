/* global localStorage */
import { test, expect } from '@playwright/test';

async function openPage(page, name) {
  await page.locator(`[data-page="${name}"]:visible`).first().click();
  await expect(page.locator(`#page-${name}`)).toHaveClass(/\bon\b/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('chief-custom');
    localStorage.removeItem('chief-stars');
    localStorage.removeItem('chief-goals-v1');
  });
  await page.reload();
});

test('portable import preserves custom prompt identity and star linkage through reload', async ({ page }) => {
  const snapshot = {
    product: 'chief-ai',
    format: 'founder-intelligence-snapshot',
    schemaVersion: 1,
    exportedAt: '2026-09-17T19:00:00.000Z',
    assets: [],
    compatibility: {
      customPrompts: [{
        id: 'portable-prompt-alpha',
        title: 'Portable starred prompt',
        sub: 'Imported through the real file-input path',
        cat: 'research',
        platforms: ['chatgpt'],
        versions: { chatgpt: 'Use only the supplied evidence.' },
        emoji: '✨',
        notes: '',
        repos: ['chief-ai-machine'],
      }],
      stars: ['portable-prompt-alpha'],
    },
    goals: [],
  };

  const reloaded = page.waitForEvent('load');
  await page.locator('#importFile').setInputFiles({
    name: 'chief-portable-snapshot.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(snapshot)),
  });
  await reloaded;

  await openPage(page, 'library');
  await expect(page.locator('#statCustom')).toHaveText('1');
  await expect(page.locator('#statStar')).toHaveText('1');

  await page.locator('.chip.c-star').click();
  const card = page.locator('#grid .pcard').filter({ hasText: 'Portable starred prompt' });
  await expect(card).toHaveCount(1);

  const persisted = await page.evaluate(() => ({
    custom: JSON.parse(localStorage.getItem('chief-custom') || '[]'),
    stars: JSON.parse(localStorage.getItem('chief-stars') || '[]'),
  }));
  expect(persisted.custom).toHaveLength(1);
  expect(persisted.custom[0].id).toBe('portable-prompt-alpha');
  expect(persisted.stars).toEqual(['portable-prompt-alpha']);
});
