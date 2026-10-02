import { test, expect } from '@playwright/test';

const baseURL = process.env.CHIEF_EDGE_BASE_URL;

test('Chief dynamic ingress rate limit is enforced through the real Worker entry', async ({ page }) => {
  test.skip(!baseURL, 'CHIEF_EDGE_BASE_URL is required for the real Worker witness');

  // Use a static, inert asset as the browser origin. It must remain outside the
  // dynamic limiter and cannot make application requests on its own.
  const staticResponse = await page.goto(`${baseURL}/README.md`);
  expect(staticResponse?.status()).toBe(200);

  // Exact /api must reach the Worker rather than fall through to SPA assets.
  const apiRoot = await page.evaluate(async () => {
    const response = await fetch('/api');
    return {
      status: response.status,
      contentType: response.headers.get('content-type'),
    };
  });
  expect(apiRoot.status).toBe(501);
  expect(apiRoot.contentType ?? '').not.toContain('text/html');

  // Cloudflare documents Worker Rate Limiting as permissive/eventually
  // consistent. Do not assert an exact first-rejection request number. Instead,
  // prove a sequential browser workload is eventually rejected by the binding.
  const proof = await page.evaluate(async () => {
    const statuses = [];
    let retryAfter = null;
    let body = null;

    for (let i = 0; i < 160; i += 1) {
      const response = await fetch('/version', { cache: 'no-store' });
      statuses.push(response.status);
      if (response.status === 429) {
        retryAfter = response.headers.get('retry-after');
        body = await response.json();
        break;
      }
    }

    const exactApi = await fetch('/api', { cache: 'no-store' });
    const exactGithub = await fetch('/github', { cache: 'no-store' });

    return {
      statuses,
      retryAfter,
      body,
      exactApiStatus: exactApi.status,
      exactGithubStatus: exactGithub.status,
    };
  });

  expect(proof.statuses).toContain(429);
  expect(proof.retryAfter).toBe('60');
  expect(proof.body).toEqual({ ok: false, error: 'rate_limit_exceeded' });
  expect(proof.exactApiStatus).toBe(429);
  expect(proof.exactGithubStatus).toBe(429);
});
