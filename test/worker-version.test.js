/* global Request, URL */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import worker from '../worker/index.js';

const wranglerConfig = readFileSync(
  new URL('../wrangler.jsonc', import.meta.url),
  'utf8',
);

describe('Chief AI Worker version receipt', () => {
  it('routes /version through the Worker before asset fallback', () => {
    expect(wranglerConfig).toMatch(
      /"run_worker_first":\s*\[\s*"\/api\/\*"\s*,\s*"\/version"\s*\]/,
    );
  });

  it('returns the explicit release SHA without touching assets', async () => {
    const response = await worker.fetch(
      new Request('https://chief-ai.example/version'),
      {
        RELEASE_SHA: '12a6d0ec74fc43d43eb459ccd4d6e129d20dbf56',
        ASSETS: {
          fetch: () => {
            throw new Error('version route should not fall through to assets');
          },
        },
      },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      ok: true,
      sha: '12a6d0ec74fc43d43eb459ccd4d6e129d20dbf56',
    });
  });

  it('reports unknown instead of fabricating a release SHA', async () => {
    const response = await worker.fetch(
      new Request('https://chief-ai.example/version'),
      {
        ASSETS: {
          fetch: () => {
            throw new Error('version route should not fall through to assets');
          },
        },
      },
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      sha: 'unknown',
    });
  });
});
