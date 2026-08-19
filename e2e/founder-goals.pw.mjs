/* global document, localStorage, window */
import { expect, test } from '@playwright/test';

const GOAL = 'Ship the smallest verified founder-goal loop';
const PROJECT = 'chief-ai-machine';
const DONE = 'A bounded founder goal is saved, marked ready, and loaded into Builder.';
const EVIDENCE = 'Current main is pinned\nFounder goal path is user-facing';
const PROOF = 'goal contract unit test green\nFounder Goals Playwright green';
const ROLLBACK = 'Revert the focused founder-goal commit.';
const NEXT_GATE = 'Founder approves merge.';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
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
  await page.evaluate(() => {
    const root = document.documentElement;
    const priorScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = priorScrollBehavior;
  });
  await page.waitForTimeout(50);

  if (testInfo.project.name === 'mobile-chromium') {
    await page.screenshot({
      path: testInfo.outputPath('founder-goals-mobile-chromium-top.png'),
    });
    await page.evaluate(() => {
      const root = document.documentElement;
      const priorScrollBehavior = root.style.scrollBehavior;
      const card = document.querySelector('.goal-item');
      root.style.scrollBehavior = 'auto';
      if (card) {
        const target = card.getBoundingClientRect().top + window.scrollY - 130;
        window.scrollTo(0, Math.max(0, target));
      }
      root.style.scrollBehavior = priorScrollBehavior;
    });
    await page.waitForTimeout(50);
    await page.screenshot({
      path: testInfo.outputPath('founder-goals-mobile-chromium-decision.png'),
    });
    return;
  }

  await page.screenshot({
    path: testInfo.outputPath(`founder-goals-${testInfo.project.name}.png`),
    fullPage: true,
  });
});
