/* global process */

import { defineConfig } from '@playwright/test';

const accessHeaders = process.env.CLOUDFLARE_ACCESS_CLIENT_ID && process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET
  ? {
      'CF-Access-Client-Id': process.env.CLOUDFLARE_ACCESS_CLIENT_ID,
      'CF-Access-Client-Secret': process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET,
    }
  : {};

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
    extraHTTPHeaders: accessHeaders,
  },
});
