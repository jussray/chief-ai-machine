import { expect, test } from '@playwright/test';

const baseURL = process.env.PROOFMODE_BASE_URL;
const expectedHead = process.env.EXPECTED_HEAD_SHA;

if (!baseURL) throw new Error('PROOFMODE_BASE_URL is required');
if (!expectedHead) throw new Error('EXPECTED_HEAD_SHA is required');

const forbiddenPaths = [
  '/.git/HEAD',
  '/.env',
  '/.dev.vars',
  '/AGENTS.md',
  '/AGENTS_FOUNDER_INTELLIGENCE.md',
  '/CHATGPT.md',
  '/PERPLEXITY.md',
  '/control-room.manifest.json',
  '/docs/CODEX.md',
  '/plugins/proofmode/src/audit.js',
  '/testdata/',
];

test.describe('Chief static asset release boundary', () => {
  test('immutable preview serves the exact candidate head', async ({ request }) => {
    const response = await request.get(`${baseURL}/version`);
    expect(response.status()).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, sha: expectedHead });
  });

  test('forbidden repository and private-runtime paths cannot surface as static assets', async ({ request }) => {
    const rootResponse = await request.get(`${baseURL}/`);
    expect(rootResponse.status()).toBe(200);
    const rootBody = await rootResponse.text();
    expect(rootBody).toContain('<!doctype html>');

    for (const path of forbiddenPaths) {
      const response = await request.get(`${baseURL}${path}`, { maxRedirects: 0 });
      const body = await response.text();

      if (response.status() === 200) {
        expect(body, `${path} must resolve only to the SPA fallback, never the underlying file`).toBe(rootBody);
        continue;
      }

      expect(
        [404, 405],
        `${path} must be absent or resolve to the SPA fallback; observed ${response.status()}`,
      ).toContain(response.status());
    }
  });
});
