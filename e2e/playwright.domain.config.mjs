/* global process */

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['domain-authority.pw.mjs', 'chief-domain-access.pw.mjs'],
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  reporter: [
    ['line'],
    ['./../scripts/proofmode-safe-reporter.mjs', { outputFile: './artifacts/domain-authority-safe.json' }],
  ],
  outputDir: '../test-results/domain-authority',
  // Access service-token headers are injected into protected app requests.
  // Disable traces, screenshots, and video so credentials cannot enter artifacts.
  use: {
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
