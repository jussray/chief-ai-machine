import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { enforceChiefEdgeRateLimit } from '../security/edge-rate-limit.mjs';

function startEdgeServer() {
  const counts = new Map();
  const env = {
    CHIEF_RATE_LIMITER: {
      async limit({ key }) {
        const next = (counts.get(key) ?? 0) + 1;
        counts.set(key, next);
        return { success: next <= 2 };
      },
    },
  };

  const server = createServer(async (req, res) => {
    try {
      const request = new Request(`http://127.0.0.1${req.url}`, {
        method: req.method,
        headers: {
          ...req.headers,
          'cf-connecting-ip': '203.0.113.77',
        },
      });

      const limited = await enforceChiefEdgeRateLimit(request, env);
      const response = limited ?? new Response(
        req.url === '/index.html'
          ? '<!doctype html><title>Chief rate-limit proof</title>'
          : JSON.stringify({ ok: true }),
        {
          status: 200,
          headers: {
            'content-type': req.url === '/index.html'
              ? 'text/html; charset=utf-8'
              : 'application/json; charset=utf-8',
          },
        },
      );

      res.statusCode = response.status;
      for (const [name, value] of response.headers) res.setHeader(name, value);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.statusCode = 500;
      res.end(String(error));
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, baseURL: `http://127.0.0.1:${address.port}` });
    });
  });
}

test('Chief dynamic ingress rate limit is enforced in the browser path', async ({ page }) => {
  const { server, baseURL } = await startEdgeServer();
  try {
    const staticResponse = await page.goto(`${baseURL}/index.html`);
    expect(staticResponse?.status()).toBe(200);

    const result = await page.evaluate(async () => {
      const first = await fetch('/version');
      const second = await fetch('/version');
      const third = await fetch('/version');
      return {
        statuses: [first.status, second.status, third.status],
        retryAfter: third.headers.get('retry-after'),
        body: await third.json(),
      };
    });

    expect(result.statuses).toEqual([200, 200, 429]);
    expect(result.retryAfter).toBe('60');
    expect(result.body).toEqual({ ok: false, error: 'rate_limit_exceeded' });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
