/* global document, localStorage, sessionStorage, window */
import { expect, test } from '@playwright/test';

const GOAL = 'Ship the smallest verified founder-goal loop';
const PROJECT = 'chief-ai-machine';
const DONE = 'A bounded founder goal is saved, marked ready, and loaded into Builder.';
const EVIDENCE = 'Current main is pinned\nFounder goal path is user-facing';
const PROOF = 'goal contract unit test green\nFounder Goals Playwright green';
const ROLLBACK = 'Revert the focused founder-goal commit.';
const NEXT_GATE = 'Founder approves merge.';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const marker = 'chief-founder-goals-playwright-initialized';
    if (sessionStorage.getItem(marker)) return;
    localStorage.clear();
    sessionStorage.setItem(marker, 'true');
  });
  await page.goto('/');
});

test('founder goal front door exposes Chief reasoning and carries the bounded plan into Builder', async ({ page }, testInfo) => {
  const goalsPage = page.locator('#page-goals');
  await expect(goalsPage).toBeVisible();
  await expect(goalsPage.getByRole('heading', { name: 'What are we trying to accomplish?' })).toBeVisible();
  await expect(page.locator('#goalReadiness')).toHaveText('0/0 ready');

  const form = page.locator('#goalForm');
  await form.locator('[name="goal"]').fill(GOAL);
  await form.locator('[name="project"]').fill(PROJECT);
  await form.locator('[name="priority"]').selectOption('now');
  await form.locator('[name="definitionOfDone"]').fill(DONE);
  await form.locator('[name="evidence"]').fill(EVIDENCE);
  await form.locator('[name="constraints"]').fill('minimal edits\nno production mutation before proof');
  await form.locator('[name="strategicLenses"]').fill('truthmode, redteam, ooda');
  await form.locator('[name="capabilities"]').fill('goalfix-v1\nrepo-audit-first');
  await form.locator('[name="proofRequirements"]').fill(PROOF);
  await form.locator('[name="rollback"]').fill(ROLLBACK);
  await form.locator('[name="nextGate"]').fill(NEXT_GATE);
  await form.getByRole('button', { name: 'Create bounded Chief plan' }).click();

  await expect(page.locator('#goalReadiness')).toHaveText('1/1 ready');
  const goalCard = page.locator('.goal-item').first();
  await expect(goalCard).toContainText(GOAL);
  await expect(goalCard).toContainText('ready');

  const trace = goalCard.getByRole('region', { name: 'Chief decision trace' });
  await expect(trace).toBeVisible();
  await expect(trace).toContainText('Reality');
  await expect(trace).toContainText('Current main is pinned');
  await expect(trace).toContainText('Reasoning route');
  await expect(trace).toContainText('truthmode → redteam +1');
  await expect(trace).toContainText('Capabilities');
  await expect(trace).toContainText('goalfix-v1 → repo-audit-first');
  await expect(trace).toContainText('Judgment');
  await expect(trace).toContainText(DONE);
  await expect(trace).toContainText('Authority');
  await expect(trace).toContainText('Chief recommends. Founder approval remains the execution gate.');
  await expect(trace).toContainText('Proof');
  await expect(trace).toContainText('goal contract unit test green → Founder Goals Playwright green');
  await expect(trace).toContainText('Next move');
  await expect(trace).toContainText(NEXT_GATE);

  await goalCard.getByRole('button', { name: 'Continue in Builder' }).click();
  await expect(page.locator('#page-builder')).toHaveClass(/\bon\b/);
  await expect(page.locator('#bRepo')).toHaveValue(PROJECT);
  await expect(page.locator('#bTask')).toHaveValue(new RegExp(GOAL));
  await expect(page.locator('#bTask')).toHaveValue(new RegExp(NEXT_GATE));
  await expect(page.locator('#bConstraints')).toHaveValue(/Proof: goal contract unit test green; Founder Goals Playwright green/);
  await expect(page.locator('#bConstraints')).toHaveValue(new RegExp(ROLLBACK));

  const noHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
  );
  expect(noHorizontalOverflow).toBe(true);

  await page.locator('[data-page="goals"]:visible').click();
  await expect(goalsPage).toBeVisible();
  await expect(page.locator('#toast')).not.toHaveClass(/\bshow\b/);

  if (testInfo.project.name === 'mobile-chromium') {
    await goalCard.screenshot({
      path: testInfo.outputPath('founder-goals-mobile-chromium-decision.png'),
    });
    return;
  }

  await page.evaluate(() => {
    const root = document.documentElement;
    const priorScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = priorScrollBehavior;
  });
  await page.waitForTimeout(50);
  await page.screenshot({
    path: testInfo.outputPath(`founder-goals-${testInfo.project.name}.png`),
    fullPage: true,
  });
});

const validLookingUnsafePlan = JSON.stringify([{
  goal: 'Legacy partial goal',
  project: 'chief-ai-machine',
  priority: 'now',
  definitionOfDone: 'A required outcome exists.',
  proofRequirements: ['Proof exists'],
  rollback: 'Revert.',
  nextGate: 'Review.',
}]);

for (const [caseName, corruptPayload] of [
  ['non-array-json', '{"unexpected":"shape"}'],
  ['invalid-goal-array', '[null]'],
  ['operationally-unsafe-goal-array', validLookingUnsafePlan],
]) {
  test(`corrupt founder-goal storage (${caseName}) renders UNKNOWN and is not overwritten`, async ({ page }, testInfo) => {
    await page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key: 'chief-goals-v1', value: corruptPayload },
    );
    await page.reload();

    await expect(page.locator('#page-goals')).toBeVisible();
    await expect(page.locator('#goalReadiness')).toHaveText('UNKNOWN');
    await expect(page.locator('#goalCount')).toHaveText('?');

    const unknown = page.locator('[data-goal-storage-truth="unknown"]');
    await expect(unknown).toBeVisible();
    await expect(unknown).toContainText('Current goal count and readiness are UNKNOWN.');
    await expect(unknown).toContainText('Nothing has been overwritten.');
    await expect(page.getByText('No founder goals yet. Define the outcome first.', { exact: true })).toHaveCount(0);
    await expect(page.locator('#goalForm button[type="submit"]')).toBeDisabled();

    const preserved = await page.evaluate(() => localStorage.getItem('chief-goals-v1'));
    expect(preserved).toBe(corruptPayload);

    await page.screenshot({
      path: testInfo.outputPath(`founder-goals-${testInfo.project.name}-${caseName}-unknown-storage.png`),
      fullPage: true,
    });
  });
}