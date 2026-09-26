/* global localStorage */
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/counsel.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('loads the Truth Weaver COUNSEL law-first layout', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Understand the law/i })).toBeVisible();
  await expect(page.getByText('GOVERNING LAW IS THE AUTHORITY.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Source Registry' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Legal Library' })).toBeVisible();
});

test('creates and persists a local-first issue', async ({ page }) => {
  await page.getByLabel('What happened?').fill('A local ordinance conflicts with a higher-level rule.');
  await page.getByLabel('Place / jurisdiction').fill('Example City, Example State, United States');
  await page.getByLabel('Title').fill('Local ordinance conflict');
  await page.getByRole('button', { name: 'Create research issue' }).click();

  await expect(page.getByRole('heading', { name: 'Local ordinance conflict' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Local ordinance conflict' })).toBeVisible();
});

test('filters source families and keeps books secondary by default', async ({ page }) => {
  await page.getByRole('button', { name: 'Primary', exact: true }).click();
  const primaryCards = page.locator('.source-card[data-source-role="primary"]');
  await expect(primaryCards.first()).toBeVisible();
  await expect(page.locator('.source-card[data-source-role="secondary"]')).toHaveCount(0);
  await expect(page.getByText('SECONDARY BY DEFAULT').first()).toBeVisible();
});

test('blocks invalid VERIFIED LAW promotion and permits a qualifying primary authority', async ({ page }) => {
  await page.getByLabel('What happened?').fill('Need to verify whether a statute governs a dispute.');
  await page.getByLabel('Place / jurisdiction').fill('Example State');
  await page.getByLabel('Title').fill('Statute verification');
  await page.getByRole('button', { name: 'Create research issue' }).click();
  await page.getByRole('tab', { name: 'Governing Law' }).click();

  await page.getByLabel('Proposition').fill('The statute requires written notice.');
  await page.getByRole('button', { name: 'Attempt VERIFIED LAW' }).click();
  await expect(page.getByText(/Promotion blocked:|UNVERIFIED LAW|SUPPORTED/).first()).toBeVisible();

  // The product refreshes the workspace after recording the first finding.
  // Synchronize on that real render instead of racing the DOM on fast/mobile runners.
  await expect(page.locator('.workspace-panel[data-panel="facts"]')).toHaveClass(/active/, { timeout: 2500 });
  await page.getByRole('tab', { name: 'Governing Law' }).click();
  await page.getByLabel('Proposition').fill('The statute requires written notice.');
  await page.getByLabel('Citation / identifier').fill('Example Code § 100');
  await page.getByLabel('Official or authenticated source confirmed').check();
  await page.getByLabel('Currentness / as-of status verified').check();
  await page.getByRole('button', { name: 'Attempt VERIFIED LAW' }).click();
  await expect(page.getByText(/VERIFIED LAW gate satisfied|VERIFIED LAW:/).first()).toBeVisible();
});

test('renders responsive legal areas and coverage on mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'mobile-only assertion');
  await expect(page.getByRole('heading', { name: 'Legal areas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Coverage' })).toBeVisible();
  await expect(page.locator('.area-card').first()).toBeVisible();
});
