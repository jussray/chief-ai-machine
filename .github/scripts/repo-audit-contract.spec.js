import { test, expect } from '@playwright/test';

test('renders and copies every evidence-first Repo Audit First variant', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin: 'http://127.0.0.1:4173',
  });
  await page.goto('http://127.0.0.1:4173');
  await page.locator('#search').fill('Repo Audit First');

  const card = page.locator('.pcard').filter({ hasText: 'Repo Audit First' });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('authoritative repository');
  await card.getByRole('button', { name: /Open/ }).click();

  await expect(page.locator('#mTitle')).toContainText('Repo Audit First');
  await expect(page.locator('#mNoteText')).toContainText('Playwright');

  for (const platform of ['Chatgpt', 'Claude', 'Perplexity']) {
    await page.getByRole('button', { name: platform, exact: true }).click();
    const body = page.locator('#mBody');
    await expect(body).toContainText('Authoritative repository');
    await expect(body).toContainText('VERIFIED');
    await expect(body).toContainText('INFERRED');
    await expect(body).toContainText('UNKNOWN');
    await expect(body).toContainText('BLOCKED');
    await expect(body).toContainText(/stop condition/i);
    await expect(body).toContainText(/rollback/i);
    await expect(body).toContainText('Playwright');

    await page.locator('#mCopy').click();
    await expect(page.locator('#toast')).toContainText('Copied!');
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toContain('Authoritative repository');
    expect(clipboard).toContain('Playwright');
  }

  await page.screenshot({
    path: 'playwright-artifacts/repo-audit-first.png',
    fullPage: true,
  });
});
