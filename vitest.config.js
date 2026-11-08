import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      'test/pr-continuity.attack20.test.mjs',
      'test/edge-rate-limit.test.mjs',
      'test/full-attack-unit.test.mjs',
      'test/reciprocal-defense.test.mjs',
      'test/reciprocal-ingress.test.mjs',
      'test/control-room-runtime-state.test.mjs',
      // This file uses node:test and is executed separately by Quality Gate.
      'test/rfc9116-static-asset.test.mjs',
      'mobile/test/mobile-contract.test.mjs',
      'e2e/**/*.spec.mjs',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: './coverage',
    },
  },
});