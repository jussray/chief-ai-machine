import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../.github/workflows/governance-required-check-materializer.yml', import.meta.url),
  'utf8',
);

const runtime = source.split('  runtime-proof:')[1]?.split('  production-proofmode-phase:')[0] || '';
const browserProof = runtime.split('      - name: Run trusted exact-runtime browser proof')[1]
  ?.split('      - name: Retain credential-free exact-runtime evidence')[0] || '';

describe('trusted candidate runtime Access safety boundary', () => {
  it('keeps pull_request_target candidate proofs free of Access credentials', () => {
    expect(source).toContain('pull_request_target:');
    expect(source).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
    expect(runtime).toContain('ref: ${{ env.TRUSTED_EVALUATOR_SHA }}');
    expect(runtime).toContain('test "$TRUSTED_EVALUATOR_SHA" = "$BASE_SHA"');
    expect(runtime).not.toContain('environment: proofmode-access-admin');
    expect(runtime).not.toContain('secrets.CLOUDFLARE_ACCESS_CLIENT_');
    expect(runtime).not.toContain('CF-Access-Client-Id');
    expect(runtime).not.toContain('CF-Access-Client-Secret');
    expect(runtime).not.toContain('route.fetch(');
  });

  it('fails closed on Access redirects instead of accepting login as proof', () => {
    expect(browserProof).toContain("actualHost.endsWith('.cloudflareaccess.com')");
    expect(browserProof).toContain('Cloudflare Access blocks candidate proof');
    expect(browserProof).toContain('assertExactRuntimeHost(page.url(), expectedHost)');
    expect(browserProof).toContain('expect(payload?.sha).toBe(expectedSha)');
  });

  it('redacts Access redirect query strings and does not save network traces', () => {
    expect(browserProof).toContain('version-final-origin=${new URL(page.url()).origin}');
    expect(browserProof).not.toContain('version-final-url=${page.url()}');
    expect(browserProof).toContain("trace:'off'");
    expect(browserProof).not.toContain("trace:'retain-on-failure'");
  });
});
