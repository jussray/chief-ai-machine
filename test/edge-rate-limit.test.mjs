/* global Request */

import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceChiefEdgeRateLimit, isChiefDynamicPath } from '../security/edge-rate-limit.mjs';

function request(path, headers = {}) {
  return new Request(`https://chief.example${path}`, { headers });
}

test('all dynamic Chief ingress paths are in the baseline scope', () => {
  for (const path of [
    '/version',
    '/mcp',
    '/github',
    '/github/install',
    '/api',
    '/api/chief/capability-plan',
    '/api/federated-relay',
  ]) {
    assert.equal(isChiefDynamicPath(path), true, path);
  }
  assert.equal(isChiefDynamicPath('/index.html'), false);
  assert.equal(isChiefDynamicPath('/styles/app.css'), false);
});

test('dynamic ingress fails closed when the Cloudflare rate-limit binding is missing', async () => {
  const response = await enforceChiefEdgeRateLimit(request('/api/chief/capability-plan'), {});
  assert.equal(response?.status, 503);
  assert.deepEqual(await response.json(), { ok: false, error: 'rate_limit_unavailable' });
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('rate-limited ingress returns 429 with Retry-After', async () => {
  let key = null;
  const response = await enforceChiefEdgeRateLimit(
    request('/mcp', { 'cf-connecting-ip': '203.0.113.17' }),
    {
      CHIEF_RATE_LIMITER: {
        async limit(input) {
          key = input.key;
          return { success: false };
        },
      },
    },
  );

  assert.equal(key, 'ip:203.0.113.17');
  assert.equal(response?.status, 429);
  assert.equal(response.headers.get('retry-after'), '60');
  assert.deepEqual(await response.json(), { ok: false, error: 'rate_limit_exceeded' });
});

test('client-controlled forwarding headers cannot choose a limiter bucket', async () => {
  const keys = [];
  const env = {
    CHIEF_RATE_LIMITER: {
      async limit({ key }) {
        keys.push(key);
        return { success: true };
      },
    },
  };

  await enforceChiefEdgeRateLimit(request('/api', { 'x-forwarded-for': '198.51.100.10' }), env);
  await enforceChiefEdgeRateLimit(request('/api', { 'x-forwarded-for': '198.51.100.11' }), env);

  assert.deepEqual(keys, ['ip:unknown', 'ip:unknown']);
});

test('allowed dynamic ingress continues and static assets bypass the limiter', async () => {
  let calls = 0;
  const env = {
    CHIEF_RATE_LIMITER: {
      async limit() {
        calls += 1;
        return { success: true };
      },
    },
  };

  assert.equal(await enforceChiefEdgeRateLimit(request('/version'), env), null);
  assert.equal(await enforceChiefEdgeRateLimit(request('/index.html'), env), null);
  assert.equal(calls, 1);
});
