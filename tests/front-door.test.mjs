/* global Request, URL */
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../front-door/worker.mjs';

const origin = 'https://chief.foundercontrolroom.org';

test('root page is the public Chief presentation', async () => {
  const response = await worker.fetch(new Request(origin + '/'));
  expect(response.status).toBe(200);
  expect(await response.text()).toMatch(/Chief AI.*Founder Intelligence OS/);
  expect(response.headers.get('Content-Security-Policy')).toMatch(/script-src 'none'/);
});

test('query-only homepage rewrite marker is presentation only', async () => {
  const r = await worker.fetch(new Request(origin + '/__frontdoor_home?utm_source=review'));
  expect(r.status).toBe(200);
  expect(await r.text()).toMatch(/Chief AI.*Founder Intelligence OS/);
});

test('public worker refuses all app/private API routes', async () => {
  for (const path of ['/api/chief/runtime-proof', '/app', '/admin', '/counsel.html']) {
    const response = await worker.fetch(new Request(origin + path));
    expect(response.status).toBe(404);
  }
  const mutation = await worker.fetch(new Request(origin + '/', { method: 'POST' }));
  expect(mutation.status).toBe(404);
});

test('public routes are exact homepage and query-only marker', () => {
  const config = JSON.parse(readFileSync(new URL('../wrangler.front-door.jsonc', import.meta.url), 'utf8'));
  expect(config.routes.map(r => r.pattern)).toEqual(['chief.foundercontrolroom.org/', 'chief.foundercontrolroom.org/__frontdoor_home*']);
  expect(config.routes.every(r => !r.pattern.includes('/api') && !r.pattern.includes('/admin'))).toBe(true);
  expect(config.preview_urls).toBe(false);
});
