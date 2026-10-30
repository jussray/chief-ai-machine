import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';

const origin = 'https://chief-ai.cloudflare.app';
const policy = [
  'Contact: mailto:support@jussco.company',
  'Expires: 2027-06-30T00:00:00.000Z',
  'Preferred-Languages: en',
  'Canonical: https://chief-ai.cloudflare.app/.well-known/security.txt',
].join('\\n') + '\\n';

test('Chief publishes its exact security.txt on GET and HEAD', async () => {
  for (const method of ['GET', 'HEAD']) {
    const response = await worker.fetch(new Request(origin + '/.well-known/security.txt', { method }), {});
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /^text\\/plain/);
    assert.equal(await response.text(), method === 'HEAD' ? '' : policy);
  }
});

test('Chief security.txt rejects non-read methods', async () => {
  const response = await worker.fetch(new Request(origin + '/.well-known/security.txt', { method: 'POST' }), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('allow'), 'GET, HEAD');
});
