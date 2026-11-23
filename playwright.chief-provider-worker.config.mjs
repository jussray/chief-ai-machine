import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: /chief-provider-worker\.pw\.mjs$/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  timeout: 20_000,
  use: {
    baseURL: 'http://127.0.0.1:4179',
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  reporter: [['line']],
});
