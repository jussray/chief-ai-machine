import { describe, expect, it } from 'vitest';
import { isDevelopmentOnlyChange } from '../scripts/classify-chief-dev-only-diff.mjs';

const oldManifest = {
  name: 'chief-ai-machine',
  scripts: { test: 'vitest run' },
  devDependencies: { vitest: '^5.0.2' },
};
const changedManifest = {
  ...oldManifest,
  devDependencies: { vitest: '^5.0.5' },
};
const oldLock = {
  name: 'chief-ai-machine',
  lockfileVersion: 3,
  packages: {
    '': { name: 'chief-ai-machine', devDependencies: { vitest: '^5.0.2' } },
    'node_modules/vitest': { version: '5.0.2', dev: true },
    'node_modules/production-dependency': { version: '1.0.0' },
  },
};
const changedLock = {
  ...oldLock,
  packages: {
    ...oldLock.packages,
    '': { name: 'chief-ai-machine', devDependencies: { vitest: '^5.0.5' } },
    'node_modules/vitest': { version: '5.0.5', dev: true },
  },
};
const args = (patch = {}) => ({
  baseManifest: oldManifest,
  headManifest: changedManifest,
  baseLock: oldLock,
  headLock: changedLock,
  changedPaths: [
    'package.json',
    'package-lock.json',
    '.github/workflows/governance-boundary-required-receipts.yml',
    'scripts/classify-chief-dev-only-diff.mjs',
    'test/chief-dev-only-diff.test.js',
  ],
  ...patch,
});

describe('Chief exact-head provider-proof applicability', () => {
  it('classifies a pure dev-tooling change without requiring a provider build', () => {
    expect(isDevelopmentOnlyChange(args())).toBe(true);
  });

  it('classifies an unchanged root manifest with dev-only lock changes as dev-only', () => {
    expect(isDevelopmentOnlyChange(args({ headManifest: oldManifest, headLock: {
      ...oldLock,
      packages: { ...oldLock.packages, 'node_modules/vitest': { version: '5.0.5', dev: true } },
    } }))).toBe(true);
  });

  it('keeps provider proof required when production dependencies change', () => {
    expect(isDevelopmentOnlyChange(args({ headManifest: {
      ...changedManifest,
      dependencies: { wrangler: '^4.0.0' },
    } }))).toBe(false);
  });

  it('keeps provider proof required for non-dev lockfile packages', () => {
    expect(isDevelopmentOnlyChange(args({ headLock: {
      ...changedLock,
      packages: {
        ...changedLock.packages,
        'node_modules/production-dependency': { version: '2.0.0' },
      },
    } }))).toBe(false);
  });

  it('keeps provider proof required for changed scripts or configuration', () => {
    expect(isDevelopmentOnlyChange(args({ headManifest: {
      ...changedManifest,
      scripts: { test: 'skip' },
    } }))).toBe(false);
    expect(isDevelopmentOnlyChange(args({ changedPaths: [
      ...args().changedPaths,
      'wrangler.jsonc',
    ] }))).toBe(false);
  });

  it('fails closed for other changed paths and missing or malformed evidence', () => {
    expect(isDevelopmentOnlyChange(args({ changedPaths: ['package-lock.json', 'worker/index.js'] }))).toBe(false);
    expect(isDevelopmentOnlyChange(args({ baseLock: null }))).toBe(false);
    expect(isDevelopmentOnlyChange(args({ changedPaths: [] }))).toBe(false);
    expect(isDevelopmentOnlyChange(args({ headLock: { packages: {} } }))).toBe(false);
  });
});
