import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /freestyle-save\.pw\.mjs$/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
});
