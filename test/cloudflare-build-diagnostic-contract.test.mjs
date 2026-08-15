import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/cloudflare-build-diagnostic.yml'),
  'utf8',
);
const inspector = readFileSync(
  resolve(process.cwd(), 'scripts/inspect-cloudflare-build.mjs'),
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