/* global process */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['domain-authority.pw.mjs'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['html', { outputFolder: '../playwright-report/domain-authority', open: 'never' }],
  ],
  outputDir: '../test-results/domain-authority',
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
});
