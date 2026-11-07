/* global localStorage */
import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const CUSTOM_KEY = 'chief-custom';
const BUILDER_PROMPT = {
  id: 'b-1720000000000',
  title: 'Builder: Goalfix v1',
  sub: 'Saved from Builder',
  cat: 'custom',
  platforms: ['chatgpt'],
  versions: { chatgpt: 'Use supplied evidence and return one verified move.' },
};
const FREESTYLE_PROMPT = {
  id: 'fs-1720000000001',
  title: 'Friend Mode v1',
  sub: 'Mirror → intent → tiny move',
  cat: 'persona',
  platforms: ['chatgpt'],
  versions: {
    chatgpt: 'Turn this raw situation into one useful move.',
    claude: 'Convert this situation into one bounded move.',
  },
  emoji: '🤝',
  notes: '',
  repos: ['bip'],
};

async function openBrain(page) {
  // NOTE: Company Brain feature is in development; export button creation depends on page initialization
  // If button is not found, the feature may not be fully wired or the page init failed
  await page.locator('[data-page="brain"]:visible').first().click();
  await expect(page.locator('#page-brain')).toHaveClass(/\bon\b/);
  const btn = page.locator('#brainExportBtn');
  if (await btn.count() === 0) {
    throw new Error('Company Brain export button not found — feature initialization may be incomplete');
  }
  await expect(btn).toBeVisible();
}

test('Company Brain exports ordinary Builder and Freestyle saves without losing prompt data', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(({ key, prompts }) => {
    localStorage.setItem(key, JSON.stringify(prompts));
  }, { key: CUSTOM_KEY, prompts: [BUILDER_PROMPT, FREESTYLE_PROMPT] });
  await page.reload();
  await openBrain(page);

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#brainExportBtn').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const snapshot = JSON.parse(await fs.readFile(downloadPath, 'utf8'));
  expect(snapshot.compatibility.customPrompts).toEqual([
    {
      ...BUILDER_PROMPT,
      emoji: '✨',
      notes: '',
      repos: [],
    },
    {
      ...FREESTYLE_PROMPT,
      platforms: ['chatgpt', 'claude'],
    },
  ]);
  expect(snapshot.compatibility.customPrompts[1].versions).toEqual(FREESTYLE_PROMPT.versions);
});