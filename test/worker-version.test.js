/* global Request, URL */

import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import worker from '../worker/index.js';

const wranglerConfig = readFileSync(
  new URL('../wrangler.jsonc', import.meta.url),
  'utf8',
);
const releaseBakeScript = readFileSync(
  new URL('../scripts/bake-worker-release-sha.mjs', import.meta.url),
  'utf8',
);
const workerSource = readFileSync(
  new URL('../worker/index.js', import.meta.url),
  'utf8',
);

describe('Chief AI Worker version receipt', () => {
  it('routes runtime endpoints through the Worker before asset fallback', () => {
    expect(wranglerConfig).toMatch(
      /"run_worker_first":\s*\[\s*"\/api\/\*"\s*,\s*"\/version"\s*,\s*"\/mcp"\s*\]/,
    );
  });

  it('exposes Cloudflare provider version metadata to the runtime', () => {
    expect(wranglerConfig).toMatch(
      /"version_metadata":\s*\{\s*"binding":\s*"CF_VERSION_METADATA"\s*\}/,
    );
    expect(workerSource).toContain('env?.CF_VERSION_METADATA');
  });

  it('bakes the Workers Builds commit SHA and branch before Wrangler bundles the Worker when the build path supports it', () => {
    expect(wranglerConfig).toMatch(
      /"build":\s*\{\s*"command":\s*"node scripts\/bake-worker-release-sha\.mjs"/,
    );
    expect(releaseBakeScript).toContain('WORKERS_CI_COMMIT_SHA');
    expect(releaseBakeScript).toContain('WORKERS_CI_BRANCH');
    expect(releaseBakeScript).toContain('BUILD_RELEASE_SHA');
    expect(releaseBakeScript).toContain('BUILD_RELEASE_BRANCH');
    expect(releaseBakeScript).toContain('worker/release-sha.js');
  });

  it('prioritizes provider-owned exact build identity over mutable release variables', () => {
    const workersCommitIndex = releaseBakeScript.indexOf('process.env.WORKERS_CI_COMMIT_SHA');
    const githubCommitIndex = releaseBakeScript.indexOf('process.env.GITHUB_SHA');
    const releaseVarIndex = releaseBakeScript.indexOf('process.env.RELEASE_SHA');
    expect(workersCommitIndex).toBeGreaterThanOrEqual(0);
    expect(githubCommitIndex).toBeGreaterThan(workersCommitIndex);
    expect(releaseVarIndex).toBeGreaterThan(githubCommitIndex);

    const workersBranchIndex = releaseBakeScript.indexOf('process.env.WORKERS_CI_BRANCH');
    const githubBranchIndex = releaseBakeScript.indexOf('process.env.GITHUB_REF_NAME');
    const releaseBranchIndex = releaseBakeScript.indexOf('process.env.RELEASE_BRANCH');
    expect(workersBranchIndex).toBeGreaterThanOrEqual(0);
    expect(githubBranchIndex).toBeGreaterThan(workersBranchIndex);
    expect(releaseBranchIndex).toBeGreaterThan(githubBranchIndex);

    const bakedRuntimeIndex = workerSource.indexOf('bakedReleaseSha,');
    const runtimeReleaseVarIndex = workerSource.indexOf('env?.RELEASE_SHA');
    expect(bakedRuntimeIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeReleaseVarIndex).toBeGreaterThan(bakedRuntimeIndex);

    const bakedBranchIndex = workerSource.indexOf('bakedReleaseBranch,');
    const runtimeReleaseBranchIndex = workerSource.indexOf('env?.RELEASE_BRANCH');
    expect(bakedBranchIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeReleaseBranchIndex).toBeGreaterThan(bakedBranchIndex);
  });

  it('returns provider version metadata with the compatibility git identity receipt', async () => {
    const response = await worker.fetch(
      new Request('https://chief-ai.example/version'),
      {
        RELEASE_SHA: '12a6d0ec74fc43d43eb459ccd4d6e129d20dbf56',
        RELEASE_BRANCH: 'policy/necessary-fix-default',
        CF_VERSION_METADATA: {
          id: '986aa81c-f5ea-41d0-bbc2-4aa059e1d28a',
          tag: 'candidate',
        },
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
      branch: 'policy/necessary-fix-default',
      version_id: '986aa81c-f5ea-41d0-bbc2-4aa059e1d28a',
      version_tag: 'candidate',
    });
  });

  it('reports unknown/null instead of fabricating identity', async () => {
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
      branch: 'unknown',
      version_id: null,
      version_tag: null,
    });
  });
});
