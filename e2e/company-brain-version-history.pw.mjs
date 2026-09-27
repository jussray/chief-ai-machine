/* global localStorage */
import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const ASSET_KEY = 'chief-intelligence-assets-v1';

async function openBrain(page) {
  await page.locator('[data-page="brain"]:visible').first().click();
  await expect(page.locator('#page-brain')).toHaveClass(/\bon\b/);
}

async function fillAsset(page, content) {
  await page.locator('#brainTitle').fill('Immutable founder decision');
  await page.locator('#brainProject').fill('Chief AI');
  await page.locator('#brainKind').selectOption('decision');
  await page.locator('#brainStatus').selectOption('approved');
  await page.locator('#brainProvider').fill('provider-neutral');
  await page.locator('#brainTags').fill('history, portability');
  await page.locator('#brainContent').fill(content);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate((key) => localStorage.removeItem(key), ASSET_KEY);
  await page.reload();
});

test('Company Brain preserves prior versions through browser export and restore', async ({ page }, testInfo) => {
  await openBrain(page);
  await fillAsset(page, 'Version one must remain recoverable.');
  await page.locator('#brainSave').click();
  await expect(page.locator('#brainList')).toContainText('v1');

  await page.locator('#brainList .citem').first().click();
  await page.locator('#brainContent').fill('Version two is the current decision.');
  await page.locator('#brainSave').click();
  await expect(page.locator('#brainList')).toContainText('v2');

  const localAsset = await page.evaluate((key) => JSON.parse(localStorage.getItem(key))[0], ASSET_KEY);
  expect(localAsset.version).toBe(2);
  expect(localAsset.historyComplete).toBe(true);
  expect(localAsset.history).toHaveLength(1);
  expect(localAsset.history[0].version).toBe(1);
  expect(localAsset.history[0].content).toBe('Version one must remain recoverable.');
  expect(localAsset.content).toBe('Version two is the current decision.');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#brainExportBtn').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).toBeTruthy();

  const snapshot = JSON.parse(await fs.readFile(downloadPath, 'utf8'));
  expect(snapshot.assets[0].version).toBe(2);
  expect(snapshot.assets[0].historyComplete).toBe(true);
  expect(snapshot.assets[0].history[0].content).toBe('Version one must remain recoverable.');

  await page.evaluate((key) => localStorage.removeItem(key), ASSET_KEY);
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#brainImportBtn').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(downloadPath);
  await page.waitForEvent('load');

  const restored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key))[0], ASSET_KEY);
  expect(restored.version).toBe(2);
  expect(restored.historyComplete).toBe(true);
  expect(restored.history[0].version).toBe(1);
  expect(restored.history[0].content).toBe('Version one must remain recoverable.');
  expect(restored.content).toBe('Version two is the current decision.');

  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-company-brain-version-history.png`),
    fullPage: true,
  });
});
