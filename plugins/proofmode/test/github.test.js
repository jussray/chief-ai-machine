import { afterEach, expect, test, vi } from 'vitest';
import { loadPublicRepositoryEvidence } from '../src/github.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('uses only the server-provided token to authenticate GitHub evidence requests', async () => {
  const requests = [];
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers || {} });

    if (String(url).endsWith('/repos/acme/app')) {
      return jsonResponse({ html_url: 'https://github.com/acme/app', default_branch: 'main' });
    }
    if (String(url).includes('/commits/')) {
      return jsonResponse({
        sha: '0123456789abcdef0123456789abcdef01234567',
        commit: { tree: { sha: 'tree-sha' } },
      });
    }
    if (String(url).includes('/git/trees/')) {
      return jsonResponse({ tree: [{ type: 'blob', path: 'README.md' }], truncated: false });
    }
    if (String(url).includes('/readme?')) {
      return jsonResponse({ content: btoa('# App'), encoding: 'base64' });
    }
    if (String(url).includes('/actions/runs?')) {
      return jsonResponse({ workflow_runs: [] });
    }
    if (String(url).includes('/deployments?')) {
      return jsonResponse([]);
    }
    return jsonResponse({}, 404);
  });

  const evidence = await loadPublicRepositoryEvidence({
    owner: 'acme',
    repo: 'app',
    ref: 'main',
    token: '  server-token  ',
  });

  expect(evidence.headSha).toBe('0123456789abcdef0123456789abcdef01234567');
  expect(requests.length).toBeGreaterThan(0);
  for (const request of requests) {
    expect(request.headers.Authorization).toBe('Bearer server-token');
  }
});

test('keeps unauthenticated public-repository support when no server token is configured', async () => {
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    expect(options.headers.Authorization).toBeUndefined();

    if (String(url).endsWith('/repos/acme/app')) {
      return jsonResponse({ html_url: 'https://github.com/acme/app', default_branch: 'main' });
    }
    if (String(url).includes('/commits/')) {
      return jsonResponse({
        sha: '0123456789abcdef0123456789abcdef01234567',
        commit: { tree: { sha: 'tree-sha' } },
      });
    }
    if (String(url).includes('/git/trees/')) {
      return jsonResponse({ tree: [], truncated: false });
    }
    if (String(url).includes('/readme?')) return jsonResponse({}, 404);
    if (String(url).includes('/actions/runs?')) return jsonResponse({ workflow_runs: [] });
    if (String(url).includes('/deployments?')) return jsonResponse([]);
    return jsonResponse({}, 404);
  });

  const evidence = await loadPublicRepositoryEvidence({ owner: 'acme', repo: 'app', ref: 'main' });
  expect(evidence.repositoryUrl).toBe('https://github.com/acme/app');
});
