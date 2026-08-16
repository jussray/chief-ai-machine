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

describe('Cloudflare build observer contract', () => {
  it('uses only the dedicated Workers Builds API token', () => {
    expect(workflow).toContain(
      'CF_API_TOKEN: ${{ secrets.CLOUDFLARE_BUILDS_API_TOKEN }}',
    );
    expect(workflow).not.toContain('secrets.CLOUDFLARE_API_TOKEN');
    expect(workflow).toContain('permissions:\n  contents: read');
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