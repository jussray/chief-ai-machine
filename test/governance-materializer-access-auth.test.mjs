import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('../.github/workflows/governance-required-check-materializer.yml', import.meta.url),
  'utf8',
);
const runtime = source.split('  runtime-proof:')[1]?.split('  production-proofmode-phase:')[0] || '';
const provider = source.split('  provider-receipt:')[1]?.split('  runtime-proof:')[0] || '';
const promptRemix = readFileSync(
  new URL('../.github/workflows/chief-prompt-remix-playwright.yml', import.meta.url),
  'utf8',
);
const providerWorker = readFileSync(
  new URL('../.github/workflows/chief-provider-route-playwright.yml', import.meta.url),
  'utf8',
);
const productionProof = readFileSync(
  new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
  'utf8',
);

describe('trusted candidate runtime proof boundary', () => {
  it('keeps pull_request_target evaluation on a trusted base snapshot without candidate credentials', () => {
    expect(source).toContain('pull_request_target:');
    expect(source).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
    expect(runtime).toContain('ref: ${{ github.sha }}');
    expect(runtime).toContain('live Cloudflare Access proof is not executed from pull_request_target');
    expect(runtime).toContain("echo 'changed=false'");
    expect(runtime).not.toContain('CLOUDFLARE_ACCESS_CLIENT_ID');
    expect(runtime).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(runtime).not.toContain('CF-Access-Client-Id');
    expect(runtime).not.toContain('CF-Access-Client-Secret');
    expect(runtime).not.toContain('actions/checkout@');
  });

  it('runs candidate-safe Chief product Playwright suites without secrets', () => {
    expect(promptRemix).toContain('pull_request:');
    expect(promptRemix).toContain('permissions:\n  contents: read');
    expect(promptRemix).toContain('npx playwright test --config=e2e/playwright.freestyle.config.mjs');
    expect(providerWorker).toContain('pull_request:');
    expect(providerWorker).toContain('permissions:\n  contents: read');
    expect(providerWorker).toContain('synthetic fixtures');
    expect(providerWorker).toContain('playwright.chief-provider-worker.config.mjs');
    expect(promptRemix).not.toContain('secrets.');
    expect(providerWorker).not.toContain('secrets.');
  });

  it('keeps protected live Access proof separate from candidate execution', () => {
    expect(runtime).not.toContain('cloudflareaccess.com');
    expect(runtime).not.toContain('CF-Access-Client-Secret');
    expect(productionProof).toContain('workflow_dispatch:');
    expect(productionProof).toContain('environment: proofmode-access-admin');
    expect(productionProof).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(productionProof).toContain("trace: 'off'");
  });

  it('waits for exact-head Cloudflare provider provenance before predecessor inheritance', () => {
    const poll = provider.indexOf('for attempt in $(seq 1 25); do');
    const inherited = provider.indexOf('inherited_sha=""');
    expect(poll).toBeGreaterThan(0);
    expect(inherited).toBeGreaterThan(poll);
    expect(provider).toContain('if has_provider_receipt "$EXPECTED_HEAD_SHA"; then');
    expect(provider).toContain('if [ "$attempt" -lt 25 ]; then sleep 3; fi');
    expect(provider).toContain('x.head_sha===expected');
    expect(provider).toContain('x.app?.id===Number(process.env.CLOUDFLARE_CHECK_APP_ID)');
    expect(provider).toContain('Provider-affecting or unclassified files changed');
    expect(provider).not.toContain('secrets.');
  });
});
