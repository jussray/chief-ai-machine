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

  it('keeps each candidate proof bound to its correct trusted execution context', () => {
    // ProofMode uses an event-bound trusted base, not PR-executed code.
    expect(proofmodeWorkflow).toContain('pull_request_target:');
    expect(proofmodeWorkflow).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || inputs.expected_head_sha }}');
    expect(proofmodeWorkflow).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
    expect(proofmodeWorkflow).toContain('ref: ${{ env.TRUSTED_EVALUATOR_SHA }}');
    expect(proofmodeWorkflow).toContain('CLOUDFLARE_CHECK_APP_ID:');
    expect(proofmodeWorkflow).toContain('x.head_sha===process.env.EXPECTED_HEAD_SHA');
    expect(proofmodeWorkflow).toContain('grep -Fq "$EXPECTED_HEAD_SHA"');
    // Capability Plan uses credential-free PR code and explicitly verifies
    // the provider-issued Version ID, candidate SHA and branch together.
    expect(capabilityWorkflow).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}');
    expect(capabilityWorkflow).toContain('EXPECTED_HEAD_BRANCH: ${{ github.event.pull_request.head.ref || github.ref_name }}');
    expect(capabilityWorkflow).toContain('node scripts/verify-cloudflare-runtime-identity.mjs');
  });

  it('keeps production proof main-only and pinned to the prebuilt version', () => {
    expect(productionWorkflow).toContain('push:\n    branches:\n      - main');
    expect(productionWorkflow).toContain('EXPECTED_HEAD_SHA: ${{ github.event_name == \'workflow_dispatch\' && inputs.expected_sha || github.sha }}');
    expect(productionWorkflow).not.toContain('pull_request:');
    expect(productionWorkflow).toContain('node scripts/validate-chief-preview.mjs version');
    expect(productionWorkflow).toContain('CLOUDFLARE_VERSION_ID');
    expect(productionWorkflow).toContain('npx wrangler versions deploy');
    expect(productionWorkflow).toContain('test "$EXPECTED_HEAD_SHA" = "$GITHUB_SHA"');
  });
});
