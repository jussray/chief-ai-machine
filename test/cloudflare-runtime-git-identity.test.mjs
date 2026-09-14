import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const verifier = readFileSync(
  new globalThis.URL('../scripts/verify-cloudflare-runtime-identity.mjs', import.meta.url),
  'utf8',
);
const proofmodeWorkflow = readFileSync(
  new globalThis.URL('../.github/workflows/proofmode-mcp-playwright.yml', import.meta.url),
  'utf8',
);
const capabilityWorkflow = readFileSync(
  new globalThis.URL('../.github/workflows/chief-capability-plan-playwright.yml', import.meta.url),
  'utf8',
);
const productionWorkflow = readFileSync(
  new globalThis.URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
  'utf8',
);

describe('Cloudflare runtime git identity contract', () => {
  it('requires provider Version ID, exact SHA, and exact branch together', () => {
    expect(verifier).toContain("const expectedHeadBranch = process.env.EXPECTED_HEAD_BRANCH?.trim();");
    expect(verifier).toContain("observation.versionId === providerIdentity.versionId");
    expect(verifier).toContain("observation.sha === expectedHeadSha");
    expect(verifier).toContain("observation.branch === expectedHeadBranch");
    expect(verifier).toContain('Expected runtime branch:');
  });

  it('binds both candidate Playwright lanes to the exact pull-request branch', () => {
    for (const workflow of [proofmodeWorkflow, capabilityWorkflow]) {
      expect(workflow).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}');
      expect(workflow).toContain('EXPECTED_HEAD_BRANCH: ${{ github.event.pull_request.head.ref || github.ref_name }}');
      expect(workflow).toContain('node scripts/verify-cloudflare-runtime-identity.mjs');
    }
  });

  it('binds production runtime proof to the pushed main ref', () => {
    expect(productionWorkflow).toContain('branches:\n      - main');
    expect(productionWorkflow).toContain('EXPECTED_HEAD_BRANCH: ${{ github.ref_name }}');
    expect(productionWorkflow).toContain('node scripts/verify-cloudflare-runtime-identity.mjs');
  });
});
