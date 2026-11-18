import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      'test/pr-continuity.attack20.test.mjs',
      'test/full-attack-unit.test.mjs',
      'test/reciprocal-defense.test.mjs',
      'test/reciprocal-ingress.test.mjs',
      'test/browser-reality-contract.test.mjs',
      'test/nvidia-*.test.mjs',
      'verification/nvidia-*.test.mjs',
      'test/securitytxt.test.mjs',
      'test/control-room-runtime-state.test.mjs',
      'test/proofmode-production-authority-verbal-receipt.test.mjs',
      '.github/skills/actions-mail-audit/tests/triage.test.mjs',
      'tests/guardrails.spec.js',
      'mobile/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json'],
      reportsDirectory: './coverage',
    },
  },
});
