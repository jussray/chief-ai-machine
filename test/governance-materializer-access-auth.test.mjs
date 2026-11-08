import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const materializer = readFileSync(
  new URL('../.github/workflows/governance-required-check-materializer.yml', import.meta.url),
  'utf8',
);

const runtime = materializer.split('  runtime-proof:')[1]?.split('  production-proofmode-phase:')[0] || '';
const secretStep = runtime.split('      - name: Run trusted exact-runtime browser proof')[1]
  ?.split('      - name: Retain credential-free exact-runtime evidence')[0] || '';

describe('trusted ProofMode runtime browser service authentication', () => {
  it('binds the trusted evaluator to protected Access secrets only in the proof step', () => {
    expect(runtime).toContain('environment: proofmode-access-admin');
    expect(runtime).toContain('test "$TRUSTED_EVALUATOR_SHA" = "$BASE_SHA"');
    expect(runtime).toContain('ref: ${{ env.TRUSTED_EVALUATOR_SHA }}');
    expect(runtime.split('      - name: Run trusted exact-runtime browser proof')[0])
      .not.toContain('secrets.CLOUDFLARE_ACCESS_CLIENT_');
    expect(secretStep).toContain('CLOUDFLARE_ACCESS_CLIENT_ID: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}');
    expect(secretStep).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
    expect(secretStep).toContain('test -n "$CLOUDFLARE_ACCESS_CLIENT_ID"');
    expect(secretStep).toContain('test -n "$CLOUDFLARE_ACCESS_CLIENT_SECRET"');
  });

  it('never forwards service-token headers off the exact HTTPS preview host or across redirects', () => {
    expect(secretStep).toContain("target.protocol !== 'https:' || target.host !== expectedHost");
    expect(secretStep).toContain("await route.continue()");
    expect(secretStep).toContain('await route.fetch({');
    expect(secretStep).toContain('maxRedirects: 0');
    expect(secretStep).toContain('await route.fulfill({ response })');
    expect(secretStep).toContain("'CF-Access-Client-Id': accessClientId");
    expect(secretStep).toContain("'CF-Access-Client-Secret': accessClientSecret");
    expect(runtime).toContain('assertExactRuntimeHost(page.url(), expectedHost)');
  });

  it('never archives credential-bearing Playwright traces or redirect query strings', () => {
    expect(secretStep).toContain("trace:'off'");
    expect(secretStep).not.toContain("trace:'retain-on-failure'");
    expect(secretStep).not.toContain('version-final-url=${page.url()}');
    expect(secretStep).toContain('version-final-origin=${new URL(page.url()).origin}');
    expect(secretStep).not.toContain('console.log(accessClientSecret)');
  });
});
