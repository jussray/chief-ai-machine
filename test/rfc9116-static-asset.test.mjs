import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('Chief RFC 9116 discovery is a bundled public static asset, not an API bypass', () => {
  const config = JSON.parse(readFileSync('wrangler.jsonc', 'utf8'));
  assert.equal(config.assets?.directory, './');
  assert.equal(config.assets?.binding, 'ASSETS');
  const first = config.assets?.run_worker_first || [];
  assert.ok(first.includes('/.well-known/security.txt'), 'exact disclosure path must invoke fail-closed Worker handler');
  assert.ok(!first.some((p) => p === '/.well-known/*' || p === '/*'), 'do not expand Worker routing beyond approved paths');
  const ignore = readFileSync('.assetsignore', 'utf8').split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith('#'));
  assert.ok(!ignore.some((s) => s === '.well-known/' || s === '.well-known/*' || s === '**/.well-known/' || s === '.*' || s === '**/.*'), 'static disclosure must not be excluded by .assetsignore');
  const disclosure = readFileSync('.well-known/security.txt', 'utf8');
  assert.match(disclosure, /^Contact: mailto:founder@jussco\.company$/m);
  const match = disclosure.match(/^Expires: ([^\r\n]+)$/m);
  assert.ok(match && Number.isFinite(Date.parse(match[1])) && Date.parse(match[1]) > Date.now(), 'disclosure expiry must be valid and in future');
  assert.match(disclosure, /^Canonical: https:\/\/chief\.foundercontrolroom\.org\/\.well-known\/security\.txt$/m);
});
