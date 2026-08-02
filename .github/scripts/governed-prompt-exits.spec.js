import { test, expect } from '@playwright/test';

const REQUIRED_TERMS = [
  'authoritative repository',
  'target branch or pr',
  'exact head',
  'evidence hierarchy',
  'verified',
  'inferred',
  'unknown',
  'blocked',
  'stop condition',
  'rollback',
  'playwright',
];

async function expectGoverned(locator, label) {
  const value = (await locator.innerText()).toLowerCase();
  for (const term of REQUIRED_TERMS) {
    expect(value, `${label} includes ${term}`).toContain(term);
  }
  return value;
}

test('governs library, builder, and freestyle display and clipboard exits', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  });
  await page.goto('http://127.0.0.1:4173');

  await page.locator('aside [data-page="library"]').click();
  await page.locator('#search').fill('Repo Audit First');
  const libraryCard = page.locator('.pcard').filter({ hasText: 'Repo Audit First' });
  await expect(libraryCard).toHaveCount(1);
  await libraryCard.click();
  const libraryBody = page.locator('#mBody');
  await expectGoverned(libraryBody, 'Library');
  await page.locator('#mCopy').click();
  await expect(page.locator('#toast')).toContainText('Copied!');
  expect(await page.evaluate(() => globalThis.navigator.clipboard.readText()))
    .toBe(await libraryBody.innerText());
  await page.locator('#mClose2').click();

  await page.locator('aside [data-page="builder"]').click();
  await page.locator('#bRepo').fill('jussray/chief-ai-machine');
  const builderBody = page.locator('#builderOut');
  const builderText = await expectGoverned(builderBody, 'Builder');
  expect(builderText).toContain('jussray/chief-ai-machine');
  expect(builderText).not.toContain('[owner/repo]');
  await page.locator('#copyBuilder').click();
  expect(await page.evaluate(() => globalThis.navigator.clipboard.readText()))
    .toBe(await builderBody.innerText());

  await page.locator('aside [data-page="freestyle"]').click();
  await page.locator('#fsAsk').fill('Debug this repository failure without guessing.');
  await page.locator('#fsGenerate').click();
  await expect(page.locator('#fsPreview')).toHaveClass(/on/);
  const freestyleBody = page.locator('#fsBody');
  await expectGoverned(freestyleBody, 'Freestyle');

  const tabs = page.locator('#fsTabs .ptab');
  const tabCount = await tabs.count();
  expect(tabCount).toBeGreaterThan(0);
  for (let index = 0; index < tabCount; index += 1) {
    await tabs.nth(index).click();
    await expectGoverned(freestyleBody, `Freestyle tab ${index + 1}`);
  }

  await page.locator('#fsCopy').click();
  expect(await page.evaluate(() => globalThis.navigator.clipboard.readText()))
    .toBe(await freestyleBody.innerText());

  await page.screenshot({
    path: 'playwright-artifacts/governed-prompt-exits.png',
    fullPage: true,
  });
});
