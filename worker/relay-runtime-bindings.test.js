import { describe, expect, it, vi } from 'vitest';
import { getReleaseSha } from './index.js';
import { makeRelayFetch } from './relay-fetch.js';

describe('Chief relay runtime bindings', () => {
  it('uses the baked release SHA when runtime SHA variables are absent', () => {
    const baked = 'a'.repeat(40);
    expect(getReleaseSha({}, baked)).toBe(baked);
  });

  it('authenticates GitHub head lookups with the server-only token', async () => {
    const fetchImpl = vi.fn(async (_input, init) => Response.json({ commit: { sha: 'b'.repeat(40) } }, { status: 200, headers: init?.headers }));
    const relayFetch = makeRelayFetch({ GITHUB_TOKEN: 'server-secret' }, fetchImpl);

    await relayFetch('https://api.github.com/repos/jussray/founder-control-room/branches/main', {
      headers: { Accept: 'application/vnd.github+json' },
    });

    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer server-secret');
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });

  it('fails closed when GitHub authentication is absent', async () => {
    const fetchImpl = vi.fn();
    const relayFetch = makeRelayFetch({}, fetchImpl);
    const response = await relayFetch('https://api.github.com/repos/jussray/founder-control-room/branches/main');

    expect(response.status).toBe(503);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never leaks the GitHub token to non-GitHub providers', async () => {
    const fetchImpl = vi.fn(async (_input, init) => Response.json({ ok: true }, { status: 200, headers: init?.headers }));
    const relayFetch = makeRelayFetch({ GITHUB_TOKEN: 'server-secret' }, fetchImpl);

    await relayFetch('https://example.supabase.co/rest/v1/rpc/test', {
      headers: { Authorization: 'Bearer supabase-service-role' },
    });

    const [, init] = fetchImpl.mock.calls[0];
    expect(init.headers.Authorization).toBe('Bearer supabase-service-role');
  });
});
