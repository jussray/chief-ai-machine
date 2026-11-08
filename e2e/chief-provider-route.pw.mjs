import { expect, test } from '@playwright/test';

const baseURL = process.env.CHIEF_PROVIDER_PROOF_URL || 'http://127.0.0.1:4179';

test('Chief provider route is mounted and fails closed in Chromium', async ({ page }) => {
  await page.goto(`${baseURL}/api/chief/provider`);
  const result = await page.evaluate(async () => {
    const response = await fetch('/api/chief/provider', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'openai',
        prompt: 'Challenge this architecture.',
      }),
    });
    return { status: response.status, body: await response.json() };
  });

  expect(result.status).toBe(503);
  expect(result.body.error.code).toBe('provider_runtime_disabled');
  expect(result.body.governance).toEqual({
    authority: 'none',
    executionAuthorized: false,
    founderApprovalCarriedForward: false,
    externalProviderCall: false,
  });
});
