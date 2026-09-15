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

test('protected control-mode names do not steer Freestyle routing', async ({ page }) => {
  await openPage(page, 'freestyle');

  const request = 'Create a strategy roadmap for this product';
  await page.locator('#fsAsk').fill(request);
  await page.locator('#fsGenerate').click();
  await expect(page.locator('#fsPreview')).toHaveClass(/\bon\b/);
  const baselineTitle = await page.locator('#fsTitle').innerText();
  const baselineBody = await page.locator('#fsBody').innerText();

  await page.locator('#fsAsk').fill(
    '/goalfix ULTRATHINK truthmode /confess redteam attackten lindymode OODA proofmode L99 ' + request,
  );
  await page.locator('#fsGenerate').click();

  await expect(page.locator('#fsTitle')).toHaveText(baselineTitle);
  await expect(page.locator('#fsBody')).toHaveText(baselineBody);
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
  expect(Object.keys(savedImmediately.versions)).toEqual(
    expect.arrayContaining(['chatgpt', 'claude', 'perplexity']),
  );
  for (const text of Object.values(savedImmediately.versions)) {
    expect(floorCount(text)).toBe(1);
  }

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
