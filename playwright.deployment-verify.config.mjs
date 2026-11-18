import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /proofmode-mcp\.pw\.mjs$/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  outputDir: './test-results/deployment-verify',
  reporter: [
    ['line'],
    ['html', { outputFolder: './playwright-report/deployment-verify', open: 'never' }],
  ],
  use: { trace: 'retain-on-failure' },
});
