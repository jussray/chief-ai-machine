import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPublicRepositoryEvidence, ProofModeGitHubError } from './github.js';

const HEAD_SHA = '0123456789abcdef0123456789abcdef01234567';
const TREE_SHA = '89abcdef0123456789abcdef0123456789abcdef';
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function installPublicRepoFixture({ workflowEvent = 'pull_request_target' } = {}) {
  globalThis.fetch = vi.fn(async (input) => {
    const url = new URL(String(input));
    const path = `${url.pathname}${url.search}`;

    if (path === '/repos/acme/app') {
      return jsonResponse({
        html_url: 'https://github.com/acme/app',
        default_branch: 'main',
        private: false,
        visibility: 'public',
      });
    }
    if (path === '/repos/acme/app/commits/main') {
      return jsonResponse({ sha: HEAD_SHA, commit: { tree: { sha: TREE_SHA } } });
    }
    if (path === `/repos/acme/app/git/trees/${TREE_SHA}?recursive=1`) {
      return jsonResponse({
        truncated: false,
        tree: [
          { type: 'blob', path: 'package.json' },
          { type: 'blob', path: 'src/index.js' },
        ],
      });
    }
    if (path === '/repos/acme/app/readme?ref=main') {
      return jsonResponse({
        encoding: 'base64',
        content: Buffer.from('# App\n').toString('base64'),
      });
    }
    if (path === `/repos/acme/app/actions/runs?head_sha=${HEAD_SHA}&per_page=20`) {
      return jsonResponse({
        workflow_runs: [{
          name: 'Quality Gate',
          conclusion: 'success',
          event: workflowEvent,
          head_sha: HEAD_SHA,
          head_branch: 'feature/example',
          html_url: 'https://github.com/acme/app/actions/runs/1',
        }],
      });
    }
    if (path === `/repos/acme/app/deployments?sha=${HEAD_SHA}&per_page=10`) {
      return jsonResponse([]);
    }

    throw new Error(`Unexpected GitHub test request: ${path}`);
  });
}

describe('ProofMode GitHub evidence loader', () => {
  it('preserves workflow event and head provenance for classifier eligibility', async () => {
    installPublicRepoFixture();

    const evidence = await loadPublicRepositoryEvidence({ owner: 'acme', repo: 'app' });

    expect(evidence.headSha).toBe(HEAD_SHA);
    expect(evidence.workflows).toEqual([{
      name: 'Quality Gate',
      conclusion: 'success',
      event: 'pull_request_target',
      headSha: HEAD_SHA,
      headBranch: 'feature/example',
      url: 'https://github.com/acme/app/actions/runs/1',
    }]);
  });

  it('rejects a non-public repository before reading its commit or tree', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse({
      html_url: 'https://github.com/acme/private-app',
      default_branch: 'main',
      private: true,
      visibility: 'private',
    }));

    await expect(loadPublicRepositoryEvidence({ owner: 'acme', repo: 'private-app' }))
      .rejects.toMatchObject({ name: 'ProofModeGitHubError', code: 'repository_unavailable' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('distinguishes provider rate limiting from generic forbidden evidence', async () => {
    globalThis.fetch = vi.fn(async () => jsonResponse(
      { message: 'API rate limit exceeded' },
      403,
      { 'x-ratelimit-remaining': '0' },
    ));

    let failure;
    try {
      await loadPublicRepositoryEvidence({ owner: 'acme', repo: 'app' });
    } catch (error) {
      failure = error;
    }

    expect(failure).toBeInstanceOf(ProofModeGitHubError);
    expect(failure).toMatchObject({ code: 'source_rate_limited' });
  });
});
