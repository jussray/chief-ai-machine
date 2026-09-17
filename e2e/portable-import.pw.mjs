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

test('portable import preserves identity and remaps reserved-id star collisions through reload', async ({ page }) => {
  const snapshot = {
    product: 'chief-ai',
    format: 'founder-intelligence-snapshot',
    schemaVersion: 1,
    exportedAt: '2026-09-17T19:00:00.000Z',
    assets: [],
    compatibility: {
      customPrompts: [
        {
          id: 'portable-prompt-alpha',
          title: 'Portable starred prompt',
          sub: 'Imported through the real file-input path',
          cat: 'research',
          platforms: ['chatgpt'],
          versions: { chatgpt: 'Use only the supplied evidence.' },
          emoji: '✨',
          notes: '',
          repos: ['chief-ai-machine'],
        },
        {
          id: '1',
          title: 'Reserved identity collision probe',
          sub: 'Must not inherit the built-in prompt identity',
          cat: 'research',
          platforms: ['chatgpt'],
          versions: { chatgpt: 'Remain a custom prompt.' },
          emoji: '✨',
          notes: '',
          repos: ['chief-ai-machine'],
        },
      ],
      stars: ['portable-prompt-alpha', '1'],
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
  await expect(page.locator('#statCustom')).toHaveText('2');
  await expect(page.locator('#statStar')).toHaveText('2');

  await page.locator('.chip.c-star').click();
  await expect(page.locator('#grid .pcard').filter({ hasText: 'Portable starred prompt' })).toHaveCount(1);
  await expect(page.locator('#grid .pcard').filter({ hasText: 'Reserved identity collision probe' })).toHaveCount(1);
  await expect(page.locator('#grid .pcard').filter({ hasText: 'Repo Audit First' })).toHaveCount(0);

  const persisted = await page.evaluate(() => ({
    custom: JSON.parse(localStorage.getItem('chief-custom') || '[]'),
    stars: JSON.parse(localStorage.getItem('chief-stars') || '[]'),
  }));
  expect(persisted.custom).toHaveLength(2);
  expect(persisted.custom[0].id).toBe('portable-prompt-alpha');
  expect(persisted.custom[1].id).toMatch(/^custom-/);
  expect(persisted.stars).toEqual([
    'portable-prompt-alpha',
    persisted.custom[1].id,
  ]);
  expect(persisted.stars).not.toContain('1');
});
