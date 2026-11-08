/* global document, localStorage, navigator, window */
import { test, expect } from '@playwright/test';

const ORIGIN = 'http://127.0.0.1:4173';
const FLOOR = 'EVIDENCE-FIRST FLOOR:';

function floorCount(text) {
  return (String(text).match(/EVIDENCE-FIRST FLOOR:/g) || []).length;
}

async function openPage(page, name) {
  await page.locator(`[data-page="${name}"]:visible`).first().click();
  await expect(page.locator(`#page-${name}`)).toHaveClass(/\bon\b/);
}

async function assertModalProvider(page, providerLabel) {
  await page.locator('#mTabs .ptab', { hasText: providerLabel }).click();
  const visibleText = await page.locator('#mBody').innerText();
  expect(visibleText.length).toBeGreaterThan(100);
  expect(floorCount(visibleText), `${providerLabel} must contain exactly one evidence floor`).toBe(1);
  expect(visibleText).toContain(FLOOR);
  await page.locator('#mCopy').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(visibleText);
  return visibleText;
}

async function reopenLatestDraft(page) {
  await openPage(page, 'custom');
  const drafts = page.locator('#customList .citem');
  await expect(drafts).toHaveCount(1);
  await drafts.last().click();
  await expect(page.locator('#modalWrap')).toHaveClass(/\bopen\b/);
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGIN });
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('chief-custom');
    localStorage.removeItem('chief-stars');
    localStorage.removeItem('chief-goals-v1');
  });
  await page.reload();
});

test('Freestyle save becomes live Library state, reopens, copies, and survives reload', async ({ page }, testInfo) => {
  await openPage(page, 'freestyle');
  await page.locator('#fsAsk').fill('Red team this product launch and attack the hidden assumptions before I invest more.');
  await page.locator('#fsGenerate').click();
  await expect(page.locator('#fsPreview')).toHaveClass(/\bon\b/);
  expect(await page.locator('#fsTabs .ptab').count()).toBeGreaterThanOrEqual(2);

  await page.locator('#fsSave').click();
  await expect(page.locator('#navCustom')).toHaveText('1');

  const savedImmediately = await page.evaluate(() => {
    const drafts = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    return drafts.at(-1) || null;
  });
  expect(savedImmediately).not.toBeNull();
  expect(savedImmediately.id).toMatch(/^freestyle-/);
  expect(Object.keys(savedImmediately.versions)).toEqual(expect.arrayContaining(['chatgpt', 'claude', 'perplexity']));
  for (const text of Object.values(savedImmediately.versions)) expect(floorCount(text)).toBe(1);

  await openPage(page, 'library');
  await page.locator('#search').fill(savedImmediately.title);
  const savedCard = page.locator('#grid .pcard').filter({
    has: page.getByRole('heading', { name: savedImmediately.title, exact: true }),
  });
  await expect(page.locator('#statCustom')).toHaveText('1');
  await expect(savedCard.last().locator('h3')).toHaveText(savedImmediately.title);
  await page.locator('#search').fill('');

  await reopenLatestDraft(page);
  const chatgptText = await assertModalProvider(page, 'Chatgpt');
  const claudeText = await assertModalProvider(page, 'Claude');
  expect(chatgptText).not.toBe('');
  expect(claudeText).not.toBe('');

  await page.screenshot({ path: testInfo.outputPath(`${testInfo.project.name}-saved-draft.png`), fullPage: true });
  await page.locator('#mClose').click();
  await expect(page.locator('#modalWrap')).not.toHaveClass(/\bopen\b/);

  await page.reload();
  await reopenLatestDraft(page);
  const persistedPerplexity = await assertModalProvider(page, 'Perplexity');
  expect(floorCount(persistedPerplexity)).toBe(1);

  const savedAfterReload = await page.evaluate(() => {
    const drafts = JSON.parse(localStorage.getItem('chief-custom') || '[]');
    return drafts.at(-1) || null;
  });
  expect(savedAfterReload).toEqual(savedImmediately);
});

test('custom prompt text stays inert, legacy star ids migrate, and delete stays coherent', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('chief-custom', JSON.stringify([{
      id: 'custom-xss-proof',
      title: '<img src=x onerror="window.__chiefStoredXss=1"> literal title',
      sub: '<svg onload="window.__chiefStoredXss=2"> literal subtitle',
      cat: '<script>window.__chiefStoredXss=3</script>',
      notes: '<img src=x onerror="window.__chiefStoredXss=4"> literal note',
      platforms: ['chatgpt'],
      versions: { chatgpt: 'Safe prompt body' },
      emoji: '<img src=x onerror="window.__chiefStoredXss=5">',
      repos: [],
    }]));
    localStorage.setItem('chief-stars', JSON.stringify(['c0']));
  });
  await page.reload();

  await openPage(page, 'library');
  await expect(page.locator('#statStar')).toHaveText('1');
  const injectedCard = page.locator('#grid .pcard').filter({ hasText: 'literal title' });
  await expect(injectedCard).toHaveCount(1);
  await expect(injectedCard.locator('h3')).toContainText('<img src=x onerror=');
  await expect(injectedCard.locator('.sub')).toContainText('<svg onload=');
  expect(await page.evaluate(() => window.__chiefStoredXss)).toBeUndefined();

  const migratedStars = await page.evaluate(() => JSON.parse(localStorage.getItem('chief-stars') || '[]'));
  expect(migratedStars).toEqual(['custom-xss-proof']);

  await page.locator('.chip.c-star').click();
  await expect(page.locator('#grid .pcard')).toHaveCount(1);

  await openPage(page, 'custom');
  await page.locator('#customList .citem .mini-btn', { hasText: 'Delete' }).click();
  await expect(page.locator('#navCustom')).toHaveText('0');

  await openPage(page, 'library');
  await expect(page.locator('#statStar')).toHaveText('0');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('chief-stars') || '[]'))).toEqual([]);
});

test('corrupt local prompt state stays UNKNOWN and every save/export path fails closed', async ({ page }) => {
  const corruptCustom = '{"broken":';
  const corruptStars = '{"stars":';
  await page.evaluate(({ custom, stars }) => {
    localStorage.setItem('chief-custom', custom);
    localStorage.setItem('chief-stars', stars);
  }, { custom: corruptCustom, stars: corruptStars });
  await page.reload();

  await openPage(page, 'library');
  await expect(page.locator('#statCustom')).toHaveText('?');
  await expect(page.locator('#statStar')).toHaveText('?');
  await expect(page.locator('#statTotal')).toHaveText('?');
  await expect(page.locator('.chip.c-star')).toBeDisabled();

  await openPage(page, 'custom');
  await expect(page.locator('#navCustom')).toHaveText('?');
  await expect(page.locator('[data-custom-storage-truth="unknown"]')).toContainText('Current custom prompt count is UNKNOWN.');
  await expect(page.locator('[data-custom-storage-truth="unknown"]')).toContainText('Nothing has been overwritten.');
  await expect(page.getByText('No custom prompts yet.', { exact: true })).toHaveCount(0);
  await expect(page.locator('#saveCustom')).toBeDisabled();

  await openPage(page, 'freestyle');
  await page.locator('#fsAsk').fill('Red team this launch before I ship it.');
  await page.locator('#fsGenerate').click();
  await page.locator('#fsSave').click();
  await expect(page.locator('#toast')).toContainText('Custom prompt state is UNKNOWN. Nothing was saved.');

  await openPage(page, 'builder');
  await page.locator('#saveBuilder').click();
  await expect(page.locator('#toast')).toContainText('Custom prompt state is UNKNOWN. Nothing was saved.');

  await page.evaluate(() => document.getElementById('exportBtn')?.click());
  await expect(page.locator('#toast')).toContainText('Export blocked');

  const preserved = await page.evaluate(() => ({
    custom: localStorage.getItem('chief-custom'),
    stars: localStorage.getItem('chief-stars'),
  }));
  expect(preserved).toEqual({ custom: corruptCustom, stars: corruptStars });
});

test('structurally hostile custom prompt canonicalizes without crashing repo filtering', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));

  await page.evaluate(() => {
    localStorage.setItem('chief-custom', JSON.stringify([{
      id: 'custom-hostile-repos',
      title: 'Hostile repo shape',
      platforms: ['CHATGPT'],
      versions: { ChatGPT: 'Safe prompt body' },
      repos: { includes: 'not-a-function' },
      authority: { granted: true },
      arbitrary: ['must', 'not', 'survive'],
    }]));
  });
  await page.reload();

  await openPage(page, 'library');
  await expect(page.locator('#statCustom')).toHaveText('1');
  const normalized = await page.evaluate(() => JSON.parse(localStorage.getItem('chief-custom') || '[]')[0] || null);
  expect(normalized).toEqual({
    id: 'custom-hostile-repos',
    title: 'Hostile repo shape',
    sub: '',
    cat: 'custom',
    notes: '',
    emoji: '✨',
    platforms: ['chatgpt'],
    versions: { chatgpt: 'Safe prompt body' },
    repos: [],
  });

  const repoFilter = page.locator('[data-repo]:visible').first();
  await repoFilter.click();
  await expect(page.locator('#page-library')).toHaveClass(/\bon\b/);
  expect(pageErrors).toEqual([]);
});

test('Builder save is visible in Library without a reload', async ({ page }) => {
  await openPage(page, 'builder');
  await page.locator('#saveBuilder').click();
  await expect(page.locator('#navCustom')).toHaveText('1');

  await openPage(page, 'library');
  await page.locator('#search').fill('Builder:');
  await expect(page.locator('#grid .pcard')).toHaveCount(1);
  await expect(page.locator('#grid .pcard h3')).toContainText('Builder:');
});

test('Friend Mode copy receipt fails closed when clipboard and fallback both fail', async ({ page }) => {
  await openPage(page, 'friend');
  await page.locator('#friendInput').fill('I need one safe next move for this build blocker.');
  await page.locator('#friendResolve').click();
  await expect(page.locator('#friendCopy')).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => { throw new Error('clipboard denied'); } },
    });
    document.execCommand = () => false;
  });

  await page.locator('#friendCopy').click();
  await expect(page.locator('#toast')).toHaveText('Copy failed. Select the move manually.');
});
