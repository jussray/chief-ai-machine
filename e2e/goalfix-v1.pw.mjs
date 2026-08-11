import { test, expect } from '@playwright/test';

async function openLibrary(page) {
  await page.locator('[data-page="library"]:visible').first().click();
  await expect(page.locator('#page-library')).toHaveClass(/\bon\b/);
}

async function openPrompt(page, title) {
  const card = page.locator('#grid .pcard', { hasText: title });
  await expect(card).toHaveCount(1);
  await card.click();
  await expect(page.locator('#modalWrap')).toHaveClass(/\bopen\b/);
  return page.locator('#mBody');
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
});

test('Goalfix v1 public pack is discoverable and preserves its truth boundary', async ({ page }, testInfo) => {
  const search = page.locator('#search');

  await search.fill('Goalfix v1');
  let body = await openPrompt(page, 'Goalfix v1 — Verified Goal Loop');
  await expect(body).toContainText('GOAL');
  await expect(body).toContainText('REALITY');
  await expect(body).toContainText('BOTTLENECK');
  await expect(body).toContainText('Missing or empty evidence is not proof of absence.');
  await page.locator('#mClose').click();

  await search.fill('Friend Mode v1');
  body = await openPrompt(page, 'Friend Mode v1 — Rant to One Move');
  await expect(body).toContainText('MIRROR');
  await expect(body).toContainText('TINY MOVE');
  await expect(body).toContainText('action_text');
  await expect(body).not.toContainText('Black woman from Philly');
  await page.locator('#mClose').click();

  await search.fill('Creative Director v1');
  body = await openPrompt(page, 'Creative Director v1 — Image Edit Contract');
  for (const label of ['KEEP', 'CHANGE', 'STYLE', 'USE', 'QUALITY GATE']) {
    await expect(body).toContainText(label);
  }

  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-goalfix-v1.png`),
    fullPage: true,
  });
});
