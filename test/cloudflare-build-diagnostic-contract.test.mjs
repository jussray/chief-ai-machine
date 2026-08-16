import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/cloudflare-build-diagnostic.yml', import.meta.url),
  'utf8',
);
const inspector = readFileSync(
  new URL('../scripts/inspect-cloudflare-build.mjs', import.meta.url),
  'utf8',
);
const classifier = readFileSync(
  new URL('../scripts/classify-cloudflare-observer-credential.mjs', import.meta.url),
  'utf8',
);

describe('Cloudflare build observer contract', () => {
  it('uses only the dedicated Workers Builds API token', () => {
    expect(workflow).toContain(
      'CF_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILDS_API_TOKEN }}',
    );
    expect(workflow).not.toContain('secrets.CLOUDFLARE_API_TOKEN');
    expect(workflow).toContain('permissions:\n  contents: read');
  });

  it('verifies both credential authority classes and catches account-id wiring mistakes', () => {
    expect(classifier).toContain('/user/tokens/verify');
    expect(classifier).toContain('/accounts/${accountId}/tokens/verify');
    expect(classifier).toContain("'account-id-stored-as-token'");
    expect(classifier).toContain('matchesAccountId');
  });

  it('rejects header-unsafe secret shapes before any provider request', () => {
    expect(classifier).toContain("'token-header-non-ascii'");
    expect(classifier).toContain("'token-includes-bearer-prefix'");
    expect(classifier).toContain("'token-header-whitespace'");
    expect(classifier).toContain('hasNonAscii');
    expect(classifier).toContain('hasLeadingOrTrailingWhitespace');
    expect(inspector).toContain("classification: 'provider-token-header-unsafe'");
    expect(inspector).toContain('CLOUDFLARE_TOKEN_PREFLIGHT_FAILED');
    expect(inspector).toContain('tokenPreflightError(receipt.providerCredentials.tokenShape)');
    expect(inspector).toContain("const apiToken = process.env.CF_API_TOKEN ?? '';");
    expect(classifier).toContain("const token = process.env.CF_API_TOKEN ?? '';");
  });

  it('verifies the user token before account or build reads', () => {
    expect(inspector).toContain('/user/tokens/verify');
    expect(inspector).toContain('tokenVerification: null');
    expect(inspector).toContain("classification = 'provider-token-invalid'");
    expect(inspector).toContain('CLOUDFLARE_USER_TOKEN_VERIFICATION_FAILED');
  });

  it('accepts an exact SHA and build UUID for reusable read-only inspection', () => {
    expect(workflow).toContain('expected_head_sha:');
    expect(workflow).toContain('build_uuid:');
    expect(workflow).toContain('inputs.expected_head_sha');
    expect(workflow).toContain('inputs.build_uuid');
    expect(inspector).toContain('/builds/builds/${encodeURIComponent(buildUuid)}');
    expect(inspector).toContain('/builds/builds/${buildUuid}/logs');
  });

  it('keeps provider mutation outside the observer lane', () => {
    expect(workflow).not.toMatch(/wrangler\s+(deploy|versions\s+upload)/i);
    expect(inspector).toContain("mode: 'read-only'");
    expect(inspector).toContain('Workers CI Read token');
  });
});