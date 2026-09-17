/* global localStorage */
import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const INTELLIGENCE_STORAGE_KEY = 'chief-intelligence-assets-v1';
const LOCAL_KEYS = [
  INTELLIGENCE_STORAGE_KEY,
  'chief-custom',
  'chief-stars',
  'chief-founder-goals-v1',
];

async function openBrain(page) {
  await page.locator('[data-page="brain"]:visible').first().click();
  await expect(page.locator('#page-brain')).toHaveClass(/\bon\b/);
  await expect(page.locator('#brainExportBtn')).toBeVisible();
  await expect(page.locator('#brainImportBtn')).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), LOCAL_KEYS);
  await page.reload();
});

test('company brain exports and restores one real asset in a clean browser state', async ({ page }, testInfo) => {
  await openBrain(page);
  await page.locator('#brainTitle').fill('Portable launch decision');
  await page.locator('#brainProject').fill('Chief AI');
  await page.locator('#brainSummary').fill('Keep the launch decision recoverable across provider changes.');
  await page.locator('#brainKind').selectOption('decision');
  await page.locator('#brainStatus').selectOption('approved');
  await page.locator('#brainProvider').fill('provider-neutral');
  await page.locator('#brainTags').fill('launch, portability, evidence');
  await page.locator('#brainContent').fill('Ship only when the exact candidate has source proof, browser proof, and a safe rollback.');
  await page.locator('#brainOutcome').fill('The decision survives export and clean restore.');
  await page.locator('#brainSave').click();

  await expect(page.locator('#brainCount')).toHaveText('1');
  await expect(page.locator('#brainList')).toContainText('Portable launch decision');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#brainExportBtn').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('chief-ai-founder-intelligence.json');
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const snapshot = JSON.parse(await fs.readFile(downloadPath, 'utf8'));
  expect(snapshot.format).toBe('founder-intelligence-snapshot');
  expect(snapshot.assets).toHaveLength(1);
  expect(snapshot.assets[0].title).toBe('Portable launch decision');
  expect(snapshot.assets[0].status).toBe('approved');

  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), LOCAL_KEYS);
  await page.reload();
  await openBrain(page);
  await expect(page.locator('#brainCount')).toHaveText('0');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#brainImportBtn').click();
  const chooser = await chooserPromise;
  const reloadPromise = page.waitForEvent('load');
  await chooser.setFiles(downloadPath);
  await reloadPromise;

  await openBrain(page);
  await expect(page.locator('#brainCount')).toHaveText('1');
  await expect(page.locator('#brainList')).toContainText('Portable launch decision');
  await expect(page.locator('#brainList')).toContainText('approved');

  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-company-brain-restored.png`),
    fullPage: true,
  });
});

test('corrupt intelligence storage blocks export without leaking stored content', async ({ page }) => {
  const corruptPayload = '{"private":"do-not-echo"';
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), {
    key: INTELLIGENCE_STORAGE_KEY,
    payload: corruptPayload,
  });
  await page.reload();
  await openBrain(page);

  let downloadObserved = false;
  page.once('download', () => { downloadObserved = true; });
  await page.locator('#brainExportBtn').click();

  await expect(page.locator('#toast')).toContainText('Portable export blocked: chief-intelligence-assets-v1 contains invalid JSON');
  await expect(page.locator('#toast')).not.toContainText('do-not-echo');
  await page.waitForTimeout(250);
  expect(downloadObserved).toBe(false);
  expect(await page.evaluate((key) => localStorage.getItem(key), INTELLIGENCE_STORAGE_KEY)).toBe(corruptPayload);
});
