import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const ALLOWED_PATHS = new Set([
  'package.json',
  'package-lock.json',
  '.github/workflows/governance-boundary-required-receipts.yml',
  'scripts/classify-chief-dev-only-diff.mjs',
  'test/chief-dev-only-diff.test.js',
]);

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const except = (object, key) => Object.fromEntries(
  Object.entries(object).filter(([name]) => name !== key),
);

// Only development-only root npm metadata and dev:true lock entries may differ.
// A new/removed production package, changed build script, path, or unknown
// lockfile shape always requires the existing Cloudflare runtime-proof gate.
export function isDevelopmentOnlyChange({
  baseManifest, headManifest, baseLock, headLock, changedPaths,
}) {
  if (!Array.isArray(changedPaths)
    || changedPaths.length === 0
    || !changedPaths.every((path) => ALLOWED_PATHS.has(path))
    || !changedPaths.some((path) => path === 'package.json' || path === 'package-lock.json')
    || ![baseManifest, headManifest, baseLock, headLock].every(isRecord)
    || ![baseLock.packages, headLock.packages].every(isRecord)) return false;

  const baseRoot = baseLock.packages[''];
  const headRoot = headLock.packages[''];
  if (!isRecord(baseRoot) || !isRecord(headRoot)) return false;

  if (!equal(except(baseManifest, 'devDependencies'), except(headManifest, 'devDependencies'))
    || !equal(except(baseLock, 'packages'), except(headLock, 'packages'))
    || !equal(except(baseRoot, 'devDependencies'), except(headRoot, 'devDependencies'))) return false;

  const changedPackages = new Set([
    ...Object.keys(baseLock.packages),
    ...Object.keys(headLock.packages),
  ]);
  changedPackages.delete('');
  for (const name of changedPackages) {
    const before = baseLock.packages[name];
    const after = headLock.packages[name];
    if (equal(before, after)) continue;
    if ((before !== undefined && (!isRecord(before) || before.dev !== true))
      || (after !== undefined && (!isRecord(after) || after.dev !== true))) return false;
  }
  return true;
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
}

function load(ref, path) {
  return JSON.parse(git('show', `${ref}:${path}`));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [baseRef, headRef] = process.argv.slice(2);
    if (!/^[0-9a-f]{40}$/i.test(baseRef || '') || !/^[0-9a-f]{40}$/i.test(headRef || '')) {
      process.exitCode = 1;
    } else {
      const developmentOnly = isDevelopmentOnlyChange({
        baseManifest: load(baseRef, 'package.json'),
        headManifest: load(headRef, 'package.json'),
        baseLock: load(baseRef, 'package-lock.json'),
        headLock: load(headRef, 'package-lock.json'),
        changedPaths: git('diff', '--name-only', baseRef, headRef).trim().split('\\n').filter(Boolean),
      });
      process.stdout.write(developmentOnly ? 'development-only-npm-diff\\n' : 'runtime-or-unverified-diff\\n');
      if (!developmentOnly) process.exitCode = 1;
    }
  } catch {
    process.exitCode = 1;
  }
}
