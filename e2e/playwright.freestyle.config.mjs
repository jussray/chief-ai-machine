import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: /(freestyle-save|goalfix-v1)\.pw\.mjs$/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  outputDir: '../test-results/freestyle-save',
  reporter: [
    ['line'],
    ['html', { outputFolder: '../playwright-report/freestyle-save', open: 'never' }],
  ],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
