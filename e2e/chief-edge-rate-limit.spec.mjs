import { test, expect } from '@playwright/test';

const baseURL = process.env.CHIEF_EDGE_BASE_URL;

test('Chief dynamic ingress rate limit is enforced through the real Worker entry', async ({ page }) => {
  test.skip(!baseURL, 'CHIEF_EDGE_BASE_URL is required for the real Worker witness');

  // Use a known inert static asset as the browser origin. Static asset delivery
  // must remain outside the dynamic API limiter.
  const staticResponse = await page.goto(`${baseURL}/styles/main.css`);
  expect(staticResponse?.status()).toBe(200);

  // Cloudflare Worker Rate Limiting is intentionally permissive/eventually
  // consistent. Do not assert an exact first-rejection request number. Instead,
  // prove a sequential browser workload is eventually rejected by the real
  // locally simulated binding and then prove the exact root paths cannot bypass
  // that exhausted bucket.
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
    const staticAfterExhaustion = await fetch('/styles/main.css', { cache: 'no-store' });

    return {
      statuses,
      retryAfter,
      body,
      exactApiStatus: exactApi.status,
      exactGithubStatus: exactGithub.status,
      staticStatus: staticAfterExhaustion.status,
    };
  });

  expect(proof.statuses).toContain(429);
  expect(proof.retryAfter).toBe('60');
  expect(proof.body).toEqual({ ok: false, error: 'rate_limit_exceeded' });
  expect(proof.exactApiStatus).toBe(429);
  expect(proof.exactGithubStatus).toBe(429);
  expect(proof.staticStatus).toBe(200);
});
