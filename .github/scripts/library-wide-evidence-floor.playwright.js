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

test('renders the evidence-first floor across every prompt family and platform', async ({ page, context }) => {
  test.setTimeout(120_000);
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  });
  await page.goto('http://127.0.0.1:4173');
  await page.locator('aside [data-page="library"]').click();

  const cards = page.locator('.pcard');
  const cardCount = await cards.count();
  expect(cardCount).toBeGreaterThan(1);

  for (let cardIndex = 0; cardIndex < cardCount; cardIndex += 1) {
    await cards.nth(cardIndex).click();
    await expect(page.locator('#modalWrap')).toHaveClass(/open/);

    const title = await page.locator('#mTitle').innerText();
    const tabs = page.locator('#mTabs .ptab');
    const tabCount = await tabs.count();
    expect(tabCount, `${title} has at least one platform`).toBeGreaterThan(0);

    for (let tabIndex = 0; tabIndex < tabCount; tabIndex += 1) {
      await tabs.nth(tabIndex).click();
      const platform = await tabs.nth(tabIndex).innerText();
      const body = (await page.locator('#mBody').innerText()).toLowerCase();

      for (const term of REQUIRED_TERMS) {
        expect(body, `${title} / ${platform} includes ${term}`).toContain(term);
      }
    }

    await page.locator('#mClose2').click();
    await expect(page.locator('#modalWrap')).not.toHaveClass(/open/);
  }

  await page.locator('#search').fill('Debug Without Thrashing');
  const debugCard = page.locator('.pcard').filter({ hasText: 'Debug Without Thrashing' });
  await expect(debugCard).toHaveCount(1);
  await debugCard.click();
  await page.locator('#mCopy').click();
  await expect(page.locator('#toast')).toContainText('Copied!');

  const clipboard = (await page.evaluate(() => globalThis.navigator.clipboard.readText())).toLowerCase();
  expect(clipboard).toContain('evidence-first floor');
  expect(clipboard).toContain('stop condition');
  expect(clipboard).toContain('playwright');

  await page.screenshot({
    path: 'playwright-artifacts/library-wide-evidence-first-floor.png',
    fullPage: true,
  });
});
