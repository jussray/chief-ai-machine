import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      'test/pr-continuity.attack20.test.mjs',
      'test/full-attack-unit.test.mjs',
      'test/reciprocal-defense.test.mjs',
      'test/reciprocal-ingress.test.mjs',
      'test/edge-rate-limit.test.mjs',
      'e2e/chief-edge-rate-limit.spec.mjs',
      'mobile/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: './coverage',
    },
  },
});
