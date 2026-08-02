import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  testMatch: 'governed-prompt-exits.playwright.js',
  use: {
    browserName: 'chromium',
  },
});
