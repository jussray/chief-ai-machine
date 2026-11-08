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


test('welcome continues to script-free onboarding and the separate existing application asset', async () => {
  const response = await worker.fetch(new Request(origin + '/'));
  const html = await response.text();
  expect(html).toBe(readFileSync(new URL('../public-face.html', import.meta.url), 'utf8'));
  expect(html).toContain('id="welcome-heading">Welcome to Chief AI.');
  expect(html).toContain('href="#onboarding">Get started');
  expect(html).toContain('id="onboarding" tabindex="-1"');
  expect(html).toContain('href="./index.html">Open Chief workspace');
  expect(html).toContain('href="#welcome">Back to welcome');
  expect(html).toContain('.onboarding-screen:target ~ .welcome-screen');
  expect(html).toContain('browser. Export a copy');
  expect(html).not.toMatch(/localStorage|sessionStorage|document\.cookie|<script[^>]*src=/);
  expect(response.headers.get('Content-Security-Policy')).toContain("script-src 'none'");
  expect((await worker.fetch(new Request(origin + '/index.html'))).status).toBe(404);
});

test('public identity uses the intended Chief canonical host without listing private flows', async () => {
  const html = await (await worker.fetch(new Request(origin + '/'))).text();
  expect(html).toContain('<link rel="canonical" href="https://chief.foundercontrolroom.org/"');
  expect(html).toContain('property="og:url" content="https://chief.foundercontrolroom.org/"');
  const jsonLd = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  expect(jsonLd.url).toBe(origin + '/');
  expect(jsonLd.offers).toBeUndefined();
});
