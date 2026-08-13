import { expect, test } from '@playwright/test';

const GOAL = 'Ship the smallest verified founder-goal loop';
const PROJECT = 'chief-ai-machine';
const DONE = 'A bounded founder goal is saved, marked ready, and loaded into Builder.';
const PROOF = 'goal contract unit test green\nFounder Goals Playwright green';
const ROLLBACK = 'Revert the focused founder-goal commit.';
const NEXT_GATE = 'Founder approves merge.';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/');
});

test('founder goal front door creates a gated plan and carries it into Builder', async ({ page }, testInfo) => {
  const goalsPage = page.locator('#page-goals');
  await expect(goalsPage).toBeVisible();
  await expect(goalsPage.getByRole('heading', { name: 'What are we trying to accomplish?' })).toBeVisible();
  await expect(page.locator('#goalReadiness')).toHaveText('0/0 ready');

  const form = page.locator('#goalForm');
  await form.locator('[name="goal"]').fill(GOAL);
  await form.locator('[name="project"]').fill(PROJECT);
  await form.locator('[name="priority"]').selectOption('now');
  await form.locator('[name="definitionOfDone"]').fill(DONE);
  await form.locator('[name="constraints"]').fill('minimal edits\nno production mutation before proof');
  await form.locator('[name="capabilities"]').fill('goalfix-v1\nrepo-audit-first');
  await form.locator('[name="proofRequirements"]').fill(PROOF);
  await form.locator('[name="rollback"]').fill(ROLLBACK);
  await form.locator('[name="nextGate"]').fill(NEXT_GATE);
  await form.getByRole('button', { name: 'Create bounded Chief plan' }).click();

  await expect(page.locator('#goalReadiness')).toHaveText('1/1 ready');
  const goalCard = page.locator('.goal-item').first();
  await expect(goalCard).toContainText(GOAL);
  await expect(goalCard).toContainText('ready');
  await expect(goalCard).toContainText(NEXT_GATE);

  await goalCard.getByRole('button', { name: 'Use in Builder' }).click();
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

  await page.screenshot({
    path: testInfo.outputPath(`founder-goals-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
