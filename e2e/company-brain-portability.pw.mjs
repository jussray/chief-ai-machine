/* global localStorage, Storage, DOMException */
import fs from 'node:fs/promises';
import { test, expect } from '@playwright/test';

const INTELLIGENCE_STORAGE_KEY = 'chief-intelligence-assets-v1';
const CUSTOM_KEY = 'chief-custom';
const STARS_KEY = 'chief-stars';
const GOALS_KEY = 'chief-goals-v1';
const LOCAL_KEYS = [INTELLIGENCE_STORAGE_KEY, CUSTOM_KEY, STARS_KEY, GOALS_KEY];

const PORTABLE_CUSTOM = {
  id: 'custom-portable',
  title: 'Portable founder prompt',
  sub: '',
  cat: 'custom',
  platforms: ['chatgpt'],
  versions: { chatgpt: 'Use exact evidence and preserve the founder decision boundary.' },
  emoji: '✨',
  notes: '',
  repos: [],
};
const PORTABLE_GOAL = {
  goal: 'Recover the company brain',
  project: 'Chief AI',
  priority: 'now',
  definitionOfDone: 'A clean browser restores all founder-owned state.',
  evidence: ['Exported snapshot is parseable.'],
  constraints: ['No silent data loss.'],
  strategicLenses: ['portability'],
  capabilities: ['company-brain'],
  proofRequirements: ['Clean-state Playwright restore'],
  rollback: 'Restore the previous browser state.',
  nextGate: 'Verify the restored state.',
  createdAt: '2026-09-17T20:00:00.000Z',
};

async function openBrain(page) {
  await page.locator('[data-page="brain"]:visible').first().click();
  await expect(page.locator('#page-brain')).toHaveClass(/\bon\b/);
  await expect(page.locator('#brainExportBtn')).toBeVisible();
  await expect(page.locator('#brainImportBtn')).toBeVisible();
}

async function chooseImport(page, filePath) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.locator('#brainImportBtn').click();
  const chooser = await chooserPromise;
  await chooser.setFiles(filePath);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), LOCAL_KEYS);
  await page.reload();
});

test('company brain exports and restores all portable founder state in a clean browser', async ({ page }, testInfo) => {
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

  await page.evaluate(({ customKey, starsKey, goalsKey, custom, goal }) => {
    localStorage.setItem(customKey, JSON.stringify([custom]));
    localStorage.setItem(starsKey, JSON.stringify([custom.id]));
    localStorage.setItem(goalsKey, JSON.stringify([goal]));
  }, {
    customKey: CUSTOM_KEY,
    starsKey: STARS_KEY,
    goalsKey: GOALS_KEY,
    custom: PORTABLE_CUSTOM,
    goal: PORTABLE_GOAL,
  });

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
  expect(snapshot.compatibility.customPrompts).toEqual([PORTABLE_CUSTOM]);
  expect(snapshot.compatibility.stars).toEqual([PORTABLE_CUSTOM.id]);
  expect(snapshot.goals).toEqual([PORTABLE_GOAL]);

  await page.evaluate((keys) => keys.forEach((key) => localStorage.removeItem(key)), LOCAL_KEYS);
  await page.reload();
  await openBrain(page);
  await expect(page.locator('#brainCount')).toHaveText('0');

  const reloadPromise = page.waitForEvent('load');
  await chooseImport(page, downloadPath);
  await reloadPromise;

  await openBrain(page);
  await expect(page.locator('#brainCount')).toHaveText('1');
  await expect(page.locator('#brainList')).toContainText('Portable launch decision');
  await expect(page.locator('#brainList')).toContainText('approved');

  const restored = await page.evaluate(({ customKey, starsKey, goalsKey }) => ({
    custom: JSON.parse(localStorage.getItem(customKey)),
    stars: JSON.parse(localStorage.getItem(starsKey)),
    goals: JSON.parse(localStorage.getItem(goalsKey)),
  }), { customKey: CUSTOM_KEY, starsKey: STARS_KEY, goalsKey: GOALS_KEY });
  expect(restored.custom).toEqual([PORTABLE_CUSTOM]);
  expect(restored.stars).toEqual([PORTABLE_CUSTOM.id]);
  expect(restored.goals).toEqual([PORTABLE_GOAL]);

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

test('corrupt star storage leaves recovery UI reachable and preserves unknown state', async ({ page }) => {
  const corruptPayload = '{"private":"star-do-not-echo"';
  await page.evaluate(({ key, payload }) => localStorage.setItem(key, payload), {
    key: STARS_KEY,
    payload: corruptPayload,
  });
  await page.reload();

  await expect(page.locator('#statStar')).toHaveText('?');
  await openBrain(page);

  let downloadObserved = false;
  page.once('download', () => { downloadObserved = true; });
  await page.locator('#brainExportBtn').click();

  await expect(page.locator('#toast')).toContainText('Portable export blocked: chief-stars contains invalid JSON');
  await expect(page.locator('#toast')).not.toContainText('star-do-not-echo');
  await page.waitForTimeout(250);
  expect(downloadObserved).toBe(false);
  expect(await page.evaluate((key) => localStorage.getItem(key), STARS_KEY)).toBe(corruptPayload);
});

test('invalid founder-goal state blocks export instead of creating an unrestorable backup', async ({ page }) => {
  const privateMarker = 'goal-private-marker';
  await page.evaluate(({ key, marker }) => localStorage.setItem(key, JSON.stringify([{
    goal: marker,
    project: 'Chief AI',
    priority: 'now',
    definitionOfDone: 'Must not export.',
    proofRequirements: [],
    rollback: 'none',
    nextGate: 'none',
  }])), { key: GOALS_KEY, marker: privateMarker });
  await page.reload();
  await openBrain(page);

  let downloadObserved = false;
  page.once('download', () => { downloadObserved = true; });
  await page.locator('#brainExportBtn').click();

  await expect(page.locator('#toast')).toContainText('Portable export blocked: founder goal 1 is invalid');
  await expect(page.locator('#toast')).not.toContainText(privateMarker);
  await page.waitForTimeout(250);
  expect(downloadObserved).toBe(false);
});

test('failed import write rolls browser storage back instead of leaving a partial restore', async ({ page }, testInfo) => {
  const originalAsset = {
    schemaVersion: 1,
    id: 'asset-original',
    workspaceId: 'default',
    projectId: 'Chief AI',
    title: 'Original state',
    summary: '',
    kind: 'decision',
    status: 'approved',
    content: 'Keep this state if import storage fails.',
    outcome: '',
    provider: 'provider-neutral',
    model: '',
    tags: [],
    source: 'manual',
    version: 1,
    createdAt: '2026-09-17T20:00:00.000Z',
    updatedAt: '2026-09-17T20:00:00.000Z',
  };
  await page.evaluate(({ key, asset }) => localStorage.setItem(key, JSON.stringify([asset])), {
    key: INTELLIGENCE_STORAGE_KEY,
    asset: originalAsset,
  });
  await page.reload();
  await openBrain(page);

  const incoming = {
    product: 'chief-ai',
    format: 'founder-intelligence-snapshot',
    schemaVersion: 1,
    exportedAt: '2026-09-17T20:10:00.000Z',
    assets: [{ ...originalAsset, id: 'asset-incoming', title: 'Incoming state' }],
    compatibility: { customPrompts: [PORTABLE_CUSTOM], stars: [PORTABLE_CUSTOM.id] },
    goals: [PORTABLE_GOAL],
  };
  const importPath = testInfo.outputPath('atomic-import.json');
  await fs.writeFile(importPath, JSON.stringify(incoming), 'utf8');

  await page.evaluate(({ starsKey }) => {
    const original = Storage.prototype.setItem;
    let injectedFailure = false;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === starsKey && !injectedFailure) {
        injectedFailure = true;
        throw new DOMException('Injected quota failure', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
  }, { starsKey: STARS_KEY });

  await chooseImport(page, importPath);
  await expect(page.locator('#toast')).toContainText('Import failed; previous local state was restored.');

  const after = await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), LOCAL_KEYS);
  expect(JSON.parse(after[INTELLIGENCE_STORAGE_KEY])).toEqual([originalAsset]);
  expect(after[CUSTOM_KEY]).toBeNull();
  expect(after[STARS_KEY]).toBeNull();
  expect(after[GOALS_KEY]).toBeNull();
});
