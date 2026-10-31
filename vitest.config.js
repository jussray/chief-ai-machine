import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Playwright browser tests require a separate runner and a real deployed TEST_URL.
    // Do not run them inside Vitest's unit-test collection.
    exclude: [...configDefaults.exclude, '**/*-playwright.test.js',
      // NVIDIA advisory suites run on the Node.js built-in test runner
      // (zero-dependency offline review bundles); not Vitest suites.
      '**/nvidia-*.test.mjs',
      // This dependency-free audit contract uses node:test; GitHub Actions runs it with node --test.
      '.github/skills/actions-mail-audit/tests/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: './coverage',
    },
  },
});
