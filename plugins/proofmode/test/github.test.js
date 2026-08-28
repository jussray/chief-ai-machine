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

test('establishes public visibility without credentials, then uses only the server token for follow-up evidence', async () => {
  const requests = [];
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers || {} });

    if (String(url).endsWith('/repos/acme/app')) {
      return jsonResponse(publicMetadata());
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
      return jsonResponse({ content: 'IyBBcHA=', encoding: 'base64' });
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
  expect(requests.length).toBeGreaterThan(1);
  expect(requests[0].headers.Authorization).toBeUndefined();
  for (const request of requests.slice(1)) {
    expect(request.headers.Authorization).toBe('Bearer server-token');
  }
});

test('keeps unauthenticated public-repository support when no server token is configured', async () => {
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    expect(options.headers.Authorization).toBeUndefined();

    if (String(url).endsWith('/repos/acme/app')) {
      return jsonResponse(publicMetadata());
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

test('reports an invalid server credential separately from public discovery', async () => {
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    if (String(url).endsWith('/repos/acme/app')) {
      expect(options.headers.Authorization).toBeUndefined();
      return jsonResponse(publicMetadata());
    }
    expect(options.headers.Authorization).toBe('Bearer bad-token');
    return jsonResponse({}, 401);
  });

  await expect(loadPublicRepositoryEvidence({
    owner: 'acme',
    repo: 'app',
    token: 'bad-token',
  })).rejects.toMatchObject({ code: 'source_auth_failed' });
});

test('reports a permission refusal on authenticated follow-up evidence', async () => {
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    if (String(url).endsWith('/repos/acme/app')) {
      expect(options.headers.Authorization).toBeUndefined();
      return jsonResponse(publicMetadata());
    }
    expect(options.headers.Authorization).toBe('Bearer server-token');
    return jsonResponse({}, 403, { 'x-ratelimit-remaining': '42' });
  });

  await expect(loadPublicRepositoryEvidence({
    owner: 'acme',
    repo: 'app',
    token: 'server-token',
  })).rejects.toMatchObject({ code: 'source_forbidden' });
});

test('reports provider rate limiting when authenticated follow-up evidence supplies rate-limit evidence', async () => {
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    if (String(url).endsWith('/repos/acme/app')) {
      expect(options.headers.Authorization).toBeUndefined();
      return jsonResponse(publicMetadata());
    }
    expect(options.headers.Authorization).toBe('Bearer server-token');
    return jsonResponse({}, 403, { 'x-ratelimit-remaining': '0' });
  });

  await expect(loadPublicRepositoryEvidence({
    owner: 'acme',
    repo: 'app',
    token: 'server-token',
  })).rejects.toMatchObject({ code: 'source_rate_limited' });
});

test.each([
  ['private', { private: true, visibility: 'private' }],
  ['internal', { private: false, visibility: 'internal' }],
])('rejects %s repositories before collecting follow-up evidence or exposing credentials', async (_kind, metadata) => {
  const requests = [];
  globalThis.fetch = vi.fn(async (url, options = {}) => {
    requests.push({ url: String(url), headers: options.headers || {} });
    if (String(url).endsWith('/repos/acme/hidden-app')) {
      return jsonResponse({
        html_url: 'https://github.com/acme/hidden-app',
        default_branch: 'main',
        ...metadata,
      });
    }
    throw new Error(`unexpected follow-up evidence request: ${url}`);
  });

  await expect(loadPublicRepositoryEvidence({
    owner: 'acme',
    repo: 'hidden-app',
    token: 'server-token',
  })).rejects.toMatchObject({ code: 'repository_unavailable' });

  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe('https://api.github.com/repos/acme/hidden-app');
  expect(requests[0].headers.Authorization).toBeUndefined();
});
