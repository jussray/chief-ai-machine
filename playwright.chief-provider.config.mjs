import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/chief-provider-route.pw.mjs',
  fullyParallel: false,
  workers: 1,
  use: {
    browserName: 'chromium',
    headless: true,
  },
});
