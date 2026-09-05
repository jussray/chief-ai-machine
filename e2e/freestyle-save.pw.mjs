/* global localStorage, navigator */
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
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(visibleText);

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
  });
  await page.reload();
});

test('Freestyle save, reopen, provider switch, copy, and reload remain governed', async ({ page }, testInfo) => {
  await openPage(page, 'freestyle');

  await page.locator('#fsAsk').fill(
    'Red team this product launch and attack the hidden assumptions before I invest more.',
  );
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
  expect(Object.keys(savedImmediately.versions)).toEqual(
    expect.arrayContaining(['chatgpt', 'claude', 'perplexity']),
  );
  for (const text of Object.values(savedImmediately.versions)) {
    expect(floorCount(text)).toBe(1);
  }

  await openPage(page, 'library');
  await page.locator('#search').fill(savedImmediately.title);
  await expect(page.locator('#grid .pcard')).toHaveCount(1);
  await expect(page.locator('#grid .pcard h3')).toHaveText(savedImmediately.title);
  await page.locator('#search').fill('');

  await reopenLatestDraft(page);
  const chatgptText = await assertModalProvider(page, 'Chatgpt');
  const claudeText = await assertModalProvider(page, 'Claude');
  expect(chatgptText).not.toBe('');
  expect(claudeText).not.toBe('');

  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-saved-draft.png`),
    fullPage: true,
  });

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

test('custom prompt text is inert, legacy star ids migrate, and delete stays coherent', async ({ page }) => {
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
    }]));
    localStorage.setItem('chief-stars', JSON.stringify(['c0']));
  });
  await page.reload();

  await openPage(page, 'library');
  await expect(page.locator('#statStar')).toHaveText('1');
  await expect(page.locator('#grid .pcard h3')).toContainText('<img src=x onerror=');
  await expect(page.locator('#grid .pcard .sub')).toContainText('<svg onload=');
  expect(await page.evaluate(() => window.__chiefStoredXss)).toBeUndefined();

  const migratedStars = await page.evaluate(
    () => JSON.parse(localStorage.getItem('chief-stars') || '[]'),
  );
  expect(migratedStars).toEqual(['custom-xss-proof']);

  await page.locator('.chip.c-star').click();
  await expect(page.locator('#grid .pcard')).toHaveCount(1);

  await openPage(page, 'custom');
  await page.locator('#customList .citem .mini-btn', { hasText: 'Delete' }).click();
  await expect(page.locator('#navCustom')).toHaveText('0');

  await openPage(page, 'library');
  await expect(page.locator('#statStar')).toHaveText('0');
  expect(await page.evaluate(
    () => JSON.parse(localStorage.getItem('chief-stars') || '[]'),
  )).toEqual([]);
});

test('malformed prompt storage fails closed instead of bricking the library', async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem('chief-custom', '{not-json');
    localStorage.setItem('chief-stars', '{also-not-json');
  });
  await page.reload();

  await openPage(page, 'library');
  await expect(page.locator('#grid .pcard').first()).toBeVisible();
  await expect(page.locator('#statCustom')).toHaveText('0');
  await expect(page.locator('#statStar')).toHaveText('0');
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
