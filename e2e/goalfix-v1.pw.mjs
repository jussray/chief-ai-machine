import { test, expect } from '@playwright/test';

async function openPage(page, name) {
  const destination = page.locator(`[data-page="${name}"]:visible`).first();
  // The approved desktop layout puts Freestyle/Drafts in the collapsed More menu.
  // Mobile keeps these links in its visible nav, so exercise the real visible route.
  if (await destination.count() === 0) {
    const menu = page.locator('.brand-top-nav .brand-more summary');
    await expect(menu).toBeVisible();
    await menu.click();
  }
  await expect(destination).toBeVisible();
  await destination.click();
  await expect(page.locator(`#page-${name}`)).toHaveClass(/\bon\b/);
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
});

test('Goalfix v1 public pack is discoverable, selectable, and truth-bounded', async ({ page }, testInfo) => {
  await openPage(page, 'library');
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
  await page.locator('#mClose').click();

  await openPage(page, 'builder');
  const pack = page.locator('#bPack');
  await expect(pack.locator('option[value="prompt:goalfix-v1-verified-loop"]')).toHaveCount(1);
  await expect(pack.locator('option[value="prompt:goalfix-v1-friend-mode"]')).toHaveCount(1);
  await expect(pack.locator('option[value="prompt:goalfix-v1-creative-director"]')).toHaveCount(1);
  await pack.selectOption('prompt:goalfix-v1-verified-loop');
  await expect(page.locator('#builderOut')).toContainText('BOTTLENECK');

  await openPage(page, 'freestyle');
  await page.locator('#fsAsk').fill('Friend Mode: turn this rant into one tiny move');
  await page.locator('#fsGenerate').click();
  await expect(page.locator('#fsTitle')).toHaveText('Friend Mode v1 — Rant to One Move');
  await expect(page.locator('#fsBody')).toContainText('TINY MOVE');

  await page.screenshot({
    path: testInfo.outputPath(`${testInfo.project.name}-goalfix-v1.png`),
    fullPage: true,
  });
});
