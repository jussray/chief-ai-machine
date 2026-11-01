/* global localStorage */
import { expect, test } from '@playwright/test';

async function openPage(page, name) {
  await page.locator(`[data-page="${name}"]:visible`).first().click();
  await expect(page.locator(`#page-${name}`)).toHaveClass(/\bon\b/);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    localStorage.removeItem('chief-custom');
    localStorage.removeItem('chief-local-first-outbox-v1');
  });
  await page.reload();
});

test('Freestyle remains writable offline and leaves a pending sync receipt', async ({ context, page }) => {
  await openPage(page, 'freestyle');
  await page.locator('#fsAsk').fill('Audit this launch locally before any network sync happens.');
  await page.locator('#fsGenerate').click();
  await expect(page.locator('#fsPreview')).toHaveClass(/\bon\b/);

  await context.setOffline(true);
  await page.locator('#fsSave').click();
  await expect(page.locator('#navCustom')).toHaveText('1');

  const offlineState = await page.evaluate(() => ({
    prompts: JSON.parse(localStorage.getItem('chief-custom') || '[]'),
    outbox: JSON.parse(localStorage.getItem('chief-local-first-outbox-v1') || '[]'),
  }));

  expect(offlineState.prompts).toHaveLength(1);
  expect(offlineState.prompts[0].id).toMatch(/^freestyle-/);
  expect(offlineState.outbox).toHaveLength(1);
  expect(offlineState.outbox[0]).toMatchObject({
    version: 1,
    storageKey: 'chief-custom',
    scope: 'custom-prompts',
    operation: 'replace',
  });
  expect(offlineState.outbox[0].payload).toEqual(offlineState.prompts);

  await context.setOffline(false);
  await page.reload();
  await openPage(page, 'custom');
  await expect(page.locator('#navCustom')).toHaveText('1');

  const afterReconnect = await page.evaluate(() => ({
    prompts: JSON.parse(localStorage.getItem('chief-custom') || '[]'),
    outbox: JSON.parse(localStorage.getItem('chief-local-first-outbox-v1') || '[]'),
  }));
  expect(afterReconnect).toEqual(offlineState);
});
