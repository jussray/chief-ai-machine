/* global Request, Response, URL */

import { describe, expect, it, vi } from 'vitest';
import worker from '../worker/index.js';

function assetBinding(handler) {
  return { fetch: vi.fn(handler) };
}

describe('Chief Worker routing authority', () => {
  it('serves /version from the Worker without consulting Static Assets', async () => {
    const assets = assetBinding(async () => new Response('asset', { status: 200 }));
    const response = await worker.fetch(
      new Request('https://chief.example/version'),
      { ASSETS: assets, RELEASE_SHA: '0123456789abcdef0123456789abcdef01234567' },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      ok: true,
      sha: '0123456789abcdef0123456789abcdef01234567',
    });
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it('serves existing static assets directly', async () => {
    const assets = assetBinding(async () => new Response('console.log("ok")', { status: 200 }));
    const request = new Request('https://chief.example/src/app.js');
    const response = await worker.fetch(request, { ASSETS: assets });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('console.log');
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });

  it('falls back browser navigation to index.html only after an asset 404', async () => {
    const assets = assetBinding(async (request) => {
      const path = new URL(request.url).pathname;
      if (path === '/index.html') return new Response('<main>Chief</main>', { status: 200 });
      return new Response('missing', { status: 404 });
    });
    const request = new Request('https://chief.example/founder/goals', {
      headers: { accept: 'text/html,application/xhtml+xml' },
    });
    const response = await worker.fetch(request, { ASSETS: assets });

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('Chief');
    expect(assets.fetch).toHaveBeenCalledTimes(2);
    expect(new URL(assets.fetch.mock.calls[1][0].url).pathname).toBe('/index.html');
  });

  it('does not turn non-HTML missing assets into the SPA shell', async () => {
    const assets = assetBinding(async () => new Response('missing', { status: 404 }));
    const request = new Request('https://chief.example/missing.json', {
      headers: { accept: 'application/json' },
    });
    const response = await worker.fetch(request, { ASSETS: assets });

    expect(response.status).toBe(404);
    expect(assets.fetch).toHaveBeenCalledTimes(1);
  });
});
