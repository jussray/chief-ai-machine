import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import httpWorker from '../worker/http-worker.js';

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

test('Chief Worker fails closed for HTML or absent disclosure assets', async () => {
  const url = 'https://chief.foundercontrolroom.org/.well-known/security.txt';
  for (const status of [200, 404]) {
    const result = await httpWorker.fetch(new Request(url), {
      ASSETS: { fetch: async () => new Response(status === 200 ? '<html>SPA</html>' : 'Not found', {
        status,
        headers: { 'content-type': status === 200 ? 'text/html' : 'text/plain' },
      }) },
    });
    assert.equal(result.status, 503, `must reject asset fallback ${status}`);
    assert.match(result.headers.get('content-type') || '', /text\/plain/);
  }
});

test('Chief Worker serves only valid GET disclosure and refuses other methods', async () => {
  const url = 'https://chief.foundercontrolroom.org/.well-known/security.txt';
  const contents = readFileSync('.well-known/security.txt', 'utf8');
  let calls = 0;
  const env = { ASSETS: { fetch: async () => { calls += 1; return new Response(contents, {status:200,headers:{'content-type':'text/plain; charset=utf-8'}}); } } };
  const ok = await httpWorker.fetch(new Request(url), env);
  assert.equal(ok.status, 200);
  assert.equal(await ok.text(), contents);
  const denied = await httpWorker.fetch(new Request(url, {method:'POST'}), env);
  assert.equal(denied.status, 405);
  assert.equal(denied.headers.get('allow'), 'GET, HEAD');
  assert.equal(calls, 1, 'unsupported method must not fetch the asset');
});
