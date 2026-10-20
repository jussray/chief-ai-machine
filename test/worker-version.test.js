/* global Request, URL */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import worker from '../worker/http-worker.js';

const wranglerConfig = readFileSync(
  new URL('../wrangler.jsonc', import.meta.url),
  'utf8',
);
const releaseBakeScript = readFileSync(
  new URL('../scripts/bake-worker-release-sha.mjs', import.meta.url),
  'utf8',
);

describe('Chief AI Worker version receipt', () => {
  it('pins the existing Chief custom domains to its own Worker', () => {
    const config = JSON.parse(wranglerConfig);
    expect(config.name).toBe('chief-ai');
    expect(config.routes).toEqual([
      { pattern: 'chief.foundercontrolroom.org', custom_domain: true },
      { pattern: 'app.chief.foundercontrolroom.org', custom_domain: true },
      { pattern: 'api.chief.foundercontrolroom.org', custom_domain: true },
    ]);
  });

  it('routes runtime endpoints through the Worker before asset fallback', () => {
    expect(JSON.parse(wranglerConfig).assets.run_worker_first).toEqual([
      '/api',
      '/api/*',
      '/github',
      '/github/*',
      '/version',
      '/mcp',
      '/.well-known/security.txt',
    ]);  });

  it('bakes the Workers Builds commit SHA before Wrangler bundles the Worker', () => {
    expect(wranglerConfig).toMatch(
      /"build":\s*\{\s*"command":\s*"node scripts\/bake-worker-release-sha\.mjs"/,
    );
    expect(releaseBakeScript).toContain('WORKERS_CI_COMMIT_SHA');
    expect(releaseBakeScript).toContain('worker/release-sha.js');
  });

  it('distinguishes the synthetic pull-request merge SHA from the exact candidate release SHA', () => {
    expect(releaseBakeScript).toContain("githubEventName === 'pull_request'");
    expect(releaseBakeScript).toContain('/^refs\\/pull\\/\\d+\\/merge$/');
    expect(releaseBakeScript).toContain("...(syntheticPullRequestMergeSha ? [] : [['GITHUB_SHA', process.env.GITHUB_SHA]])");
    expect(releaseBakeScript).toContain("['WORKERS_CI_COMMIT_SHA', process.env.WORKERS_CI_COMMIT_SHA]");
    expect(releaseBakeScript).toContain("throw new Error('Release SHA inputs disagree; refusing to bake ambiguous artifact identity')");
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
