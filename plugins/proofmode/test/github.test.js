import { afterEach, expect, test, vi } from 'vitest';
import { loadPublicRepositoryEvidence } from '../src/github.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

function jsonResponse(body, status = 200, headers = {}) {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), String(value)]),
  );
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: {
      get(name) {
        return normalizedHeaders[String(name).toLowerCase()] || null;
      },
    },
    async json() {
      return body;
    },
  };
}

function publicMetadata() {
  return {
    html_url: 'https://github.com/acme/app',
    default_branch: 'main',
    private: false,
    visibility: 'public',
  };
}

function installAnonymousPublicFixture() {
  const requests = [];
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers || {} });
    expect(options.headers.Authorization).toBeUndefined();

    if (String(url).endsWith('/repos/acme/app')) return jsonResponse(publicMetadata());
    if (String(url).includes('/commits/')) {
      return jsonResponse({
        sha: '0123456789abcdef0123456789abcdef01234567',
        commit: { tree: { sha: 'tree-sha' } },
      });
    }
    if (String(url).includes('/git/trees/')) {
      return jsonResponse({ tree: [{ type: 'blob', path: 'README.md' }], truncated: false });
    }
    if (String(url).includes('/readme?')) return jsonResponse({ content: 'IyBBcHA=', encoding: 'base64' });
    if (String(url).includes('/actions/runs?')) return jsonResponse({ workflow_runs: [] });
    if (String(url).includes('/deployments?')) return jsonResponse([]);
    return jsonResponse({}, 404);
  });
  return requests;
}

test('collects public repository evidence without sending credentials on any request', async () => {
  const requests = installAnonymousPublicFixture();
  const evidence = await loadPublicRepositoryEvidence({ owner: 'acme', repo: 'app', ref: 'main' });
  expect(evidence.headSha).toBe('0123456789abcdef0123456789abcdef01234567');
  expect(requests.length).toBeGreaterThan(1);
  for (const request of requests) expect(request.headers.Authorization).toBeUndefined();
});

test('reports an anonymous public permission refusal', async () => {
  let calls = 0;
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    expect(options.headers.Authorization).toBeUndefined();
    calls += 1;
    if (String(url).endsWith('/repos/acme/app')) return jsonResponse(publicMetadata());
    return jsonResponse({}, 403, { 'x-ratelimit-remaining': '42' });
  });

  await expect(loadPublicRepositoryEvidence({ owner: 'acme', repo: 'app' }))
    .rejects.toMatchObject({ code: 'source_forbidden' });
  expect(calls).toBe(2);
});

test('reports provider rate limiting on anonymous follow-up evidence', async () => {
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    expect(options.headers.Authorization).toBeUndefined();
    if (String(url).endsWith('/repos/acme/app')) return jsonResponse(publicMetadata());
    return jsonResponse({}, 403, { 'x-ratelimit-remaining': '0' });
  });

  await expect(loadPublicRepositoryEvidence({ owner: 'acme', repo: 'app' }))
    .rejects.toMatchObject({ code: 'source_rate_limited' });
});

test.each([
  ['private', { private: true, visibility: 'private' }],
  ['internal', { private: false, visibility: 'internal' }],
])('rejects %s repositories before collecting follow-up evidence', async (_kind, metadata) => {
  const requests = [];
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers || {} });
    expect(options.headers.Authorization).toBeUndefined();
    if (String(url).endsWith('/repos/acme/hidden-app')) {
      return jsonResponse({
        html_url: 'https://github.com/acme/hidden-app',
        default_branch: 'main',
        ...metadata,
      });
    }
    throw new Error(`unexpected follow-up evidence request: ${url}`);
  });

  await expect(loadPublicRepositoryEvidence({ owner: 'acme', repo: 'hidden-app' }))
    .rejects.toMatchObject({ code: 'repository_unavailable' });
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://api.github.com/repos/acme/hidden-app');
});
