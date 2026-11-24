import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import worker from '../front-door/worker.mjs';

const standaloneOrigin = 'https://chief.jussco.company';
const fcrOrigin = 'https://chief.foundercontrolroom.org';

test('standalone Chief hostname serves its independent public front door', async () => {
  const response = await worker.fetch(new Request(standaloneOrigin + '/'));
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('<title>Chief AI | Independent Founder Intelligence</title>');
  expect(html).toContain('<link rel="canonical" href="https://chief.jussco.company/"');
  expect(html).toContain('independent Juss&Co product');
  expect(html).toContain('Founder Control Room, PromptOS, and SolContinuity');
  expect(html).toContain('href="/app">Open Chief workspace');
  expect(response.headers.get('Content-Security-Policy')).toMatch(/script-src 'none'/);
});

test('FCR hostname serves the FCR-branded Chief integration front door', async () => {
  const response = await worker.fetch(new Request(fcrOrigin + '/'));
  const html = await response.text();
  expect(response.status).toBe(200);
  expect(html).toContain('<title>Founder Control Room | Chief Intelligence</title>');
  expect(html).toContain('<link rel="canonical" href="https://chief.foundercontrolroom.org/"');
  expect(html).toContain('Chief intelligence inside Founder Control Room.');
  expect(html).toContain('FCR retains founder governance, evidence, approval, and execution authority.');
  expect(html).toContain('Founder Control Room retains its own identity');
  expect(html).toContain('href="/app">Open Chief workspace');
  expect(response.headers.get('Content-Security-Policy')).toMatch(/script-src 'none'/);
  expect(html).toBe(readFileSync(new URL('../public-face.html', import.meta.url), 'utf8'));
});

test('query-only FCR homepage marker remains presentation only', async () => {
  const response = await worker.fetch(new Request(fcrOrigin + '/__frontdoor_home?utm_source=review'));
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('Founder Control Room | Chief Intelligence');
});

test('public front door refuses private paths, unknown hosts, and mutations', async () => {
  for (const origin of [standaloneOrigin, fcrOrigin]) {
    for (const path of ['/api/chief/runtime-proof', '/app', '/admin', '/counsel.html', '/index.html']) {
      const response = await worker.fetch(new Request(origin + path));
      expect(response.status).toBe(404);
    }
    const mutation = await worker.fetch(new Request(origin + '/', { method: 'POST' }));
    expect(mutation.status).toBe(404);
  }
  expect((await worker.fetch(new Request('https://evil.example/'))).status).toBe(404);
});

test('public roots override only root paths; Chief app path overrides the JussCo wildcard', () => {
  const frontDoor = JSON.parse(readFileSync(new URL('../wrangler.front-door.jsonc', import.meta.url), 'utf8'));
  const runtime = JSON.parse(readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
  expect(frontDoor.routes.map(r => r.pattern)).toEqual([
    'chief.jussco.company/',
    'chief.foundercontrolroom.org/',
    'chief.foundercontrolroom.org/__frontdoor_home*',
  ]);
  expect(frontDoor.routes.every(r => !r.pattern.includes('/api') && !r.pattern.includes('/admin'))).toBe(true);
  expect(frontDoor.preview_urls).toBe(false);

  expect(runtime.routes).toContainEqual({ pattern: 'chief.jussco.company/*', zone_name: 'jussco.company' });
  expect(runtime.routes.filter(r => r.custom_domain === true)).toEqual([
    { pattern: 'chief.jussco.company', custom_domain: true },
    { pattern: 'chief.foundercontrolroom.org', custom_domain: true },
  ]);

  const deployment = readFileSync(new URL('../.github/workflows/cloudflare-workers-deploy.yml', import.meta.url), 'utf8');
  expect(deployment).toContain("'wrangler.front-door.jsonc'");
  expect(deployment).toContain('npx wrangler deploy --config wrangler.front-door.jsonc');
});
