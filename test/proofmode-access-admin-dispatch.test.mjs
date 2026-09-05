import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const capabilityWorkflow = readFileSync(
  new globalThis.URL('../.github/workflows/chief-capability-plan-playwright.yml', import.meta.url),
  'utf8',
);
const accessAdminWorkflow = readFileSync(
  new globalThis.URL('../.github/workflows/proofmode-access-service-auth.yml', import.meta.url),
  'utf8',
);
const proofModeWorkflow = readFileSync(
  new globalThis.URL('../.github/workflows/proofmode-mcp-playwright.yml', import.meta.url),
  'utf8',
);
const productionProofModeWorkflow = readFileSync(
  new globalThis.URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
  'utf8',
);
const operationalAuthority = JSON.parse(readFileSync(
  new globalThis.URL('../config/operational-authority.json', import.meta.url),
  'utf8',
));

const TRUSTED_ADMIN_SHA = 'c1acda4363099b7233d5857e8d2e4c97163ef42d';
const TRUSTED_ADMIN_CALL = `uses: jussray/chief-ai-machine/.github/workflows/proofmode-access-service-auth.yml@${TRUSTED_ADMIN_SHA}`;

describe('ProofMode Access admin dispatch bootstrap', () => {
  it('routes Access check/repair through an immutable reusable admin revision', () => {
    expect(capabilityWorkflow).toContain('workflow_dispatch:');
    expect(capabilityWorkflow).toContain('access_mode:');
    expect(capabilityWorkflow).toContain(TRUSTED_ADMIN_CALL);
    expect(capabilityWorkflow).not.toContain('uses: ./.github/workflows/proofmode-access-service-auth.yml');
    expect(capabilityWorkflow).not.toContain('secrets: inherit');
    expect(capabilityWorkflow).not.toContain('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
    expect(capabilityWorkflow).not.toContain('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN: ${{ secrets.CLOUDFLARE_ACCESS_ADMIN_API_TOKEN }}');
  });

  it('fails closed when a manual dispatch does not prove the selected ref owns the intended exact head', () => {
    expect(capabilityWorkflow).toContain('expected_head_sha:');
    expect(capabilityWorkflow).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || inputs.expected_head_sha || github.sha }}');
    expect(capabilityWorkflow).toContain('name: Verify manual dispatch identity');
    expect(capabilityWorkflow).toContain('DISPATCH_SHA: ${{ github.sha }}');
    expect(capabilityWorkflow).toContain('if [ "$EXPECTED_HEAD_SHA" != "$DISPATCH_SHA" ]; then');
    expect(capabilityWorkflow).toContain('Manual proof identity mismatch:');
    expect(capabilityWorkflow).toContain("const raw = process.argv[1].trim();");
    expect(capabilityWorkflow).toContain('base_url: ${{ steps.guard.outputs.base_url }}');
    expect(capabilityWorkflow).toContain('needs: dispatch-identity');
  });

  it('keeps privileged Access admin work manual, rechecks on verify, and scopes repair to the normalized immutable target', () => {
    expect(capabilityWorkflow).toContain("github.event_name == 'workflow_dispatch' && 'Redacted provider receipt'");
    expect(capabilityWorkflow).toContain("if: ${{ github.event_name == 'workflow_dispatch' }}");
    expect(capabilityWorkflow).toContain("mode: ${{ inputs.access_mode == 'repair' && 'repair' || 'check' }}");
    expect(capabilityWorkflow).not.toContain('mode: ${{ inputs.access_mode }}');
    expect(capabilityWorkflow).toContain('target_url: ${{ needs.dispatch-identity.outputs.base_url }}');
    expect(capabilityWorkflow).not.toContain('target_url: ${{ inputs.base_url }}');
    expect(capabilityWorkflow).toContain('      - access-policy-admin');
    expect(capabilityWorkflow).not.toContain('github.event.pull_request.number == 143');
    expect(capabilityWorkflow).not.toContain('https://0a541f03-chief-ai.mcgill-raylene.workers.dev');
  });

  it('fails required provider and exact-runtime receipts closed on PR events instead of relying on skipped-job success', () => {
    expect(capabilityWorkflow).toContain('provider-receipt-pr-gate:');
    expect(capabilityWorkflow).toContain("github.event_name == 'pull_request' && 'Redacted provider receipt'");
    expect(capabilityWorkflow).toContain('Fail closed before protected provider receipt');
    expect(capabilityWorkflow).toContain('exact-runtime-pr-gate:');
    expect(capabilityWorkflow).toContain("github.event_name == 'pull_request' && 'Verify exact Chief runtime with Playwright'");
    expect(capabilityWorkflow).toContain('Fail closed before exact-runtime receipt');
  });

  it('binds the exact-runtime required context to an explicit successful privileged runtime result', () => {
    expect(capabilityWorkflow).toContain("github.event_name == 'workflow_dispatch' && inputs.access_mode == 'verify' && 'Verify exact Chief runtime with Playwright'");
    expect(capabilityWorkflow).toContain("if: ${{ always() && github.event_name == 'workflow_dispatch' && inputs.access_mode == 'verify' }}");
    expect(capabilityWorkflow).toContain('needs: runtime-proof');
    expect(capabilityWorkflow).toContain('RUNTIME_PROOF_RESULT: ${{ needs.runtime-proof.result }}');
    expect(capabilityWorkflow).toContain('if [ "$RUNTIME_PROOF_RESULT" != "success" ]; then');
    expect(capabilityWorkflow).toContain('Exact Chief runtime compatibility receipt is derived only from a successful privileged live runtime and Playwright job');
  });

  it('keeps provider credentials inside a reusable-only workflow that checks out its own immutable source', () => {
    expect(accessAdminWorkflow).toContain('workflow_call:');
    expect(accessAdminWorkflow).not.toContain('workflow_dispatch:');
    expect(accessAdminWorkflow).toContain('environment: proofmode-access-admin');
    expect(accessAdminWorkflow).toContain('repository: ${{ job.workflow_repository }}');
    expect(accessAdminWorkflow).toContain('ref: ${{ job.workflow_sha }}');
    expect(accessAdminWorkflow).not.toContain('ref: ${{ github.sha }}');
    expect(accessAdminWorkflow).toContain('test "$actual" = "$TRUSTED_WORKFLOW_SHA"');
    expect(accessAdminWorkflow).toContain('run: node scripts/proofmode-access-policy.mjs');
  });

  it('sources admin credentials and stable provider identity only from the protected environment job', () => {
    expect(accessAdminWorkflow).not.toContain('    secrets:\n      CLOUDFLARE_ACCOUNT_ID:');
    for (const secret of [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_ACCESS_ADMIN_API_TOKEN',
      'CLOUDFLARE_ACCESS_CLIENT_ID',
      'CLOUDFLARE_ACCESS_APP_ID',
    ]) {
      expect(accessAdminWorkflow).toContain(`${secret}: \${{ secrets.${secret} }}`);
    }
    expect(accessAdminWorkflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
  });

  it('separates pre-merge candidate ProofMode runtime proof from post-merge production proof', () => {
    expect(proofModeWorkflow).toContain("'Verify candidate ProofMode runtime with Playwright'");
    expect(proofModeWorkflow).toContain("'Verify live ProofMode MCP with Playwright'");
    expect(proofModeWorkflow).toContain('environment: proofmode-access-admin');
    expect(proofModeWorkflow).toContain('Verify immutable preview serves exact head');
    expect(proofModeWorkflow).not.toContain('Verify production ProofMode MCP with Playwright');

    expect(productionProofModeWorkflow).toContain('name: Verify production ProofMode MCP with Playwright');
    expect(productionProofModeWorkflow).toContain('environment: proofmode-access-admin');
    expect(productionProofModeWorkflow).not.toContain('pull_request:');
    expect(productionProofModeWorkflow).toContain('Guard production proof to current main only');
    expect(productionProofModeWorkflow).toContain('if [ "$EVENT_REF" != "refs/heads/main" ]; then');
    expect(productionProofModeWorkflow).toContain('if [ -z "$current" ] || [ "$current" != "$GITHUB_SHA" ]; then');
    expect(productionProofModeWorkflow).not.toContain('Verify candidate ProofMode runtime with Playwright');

    expect(operationalAuthority.proofContextSemantics).toMatchObject({
      legacyPreMergeProofModeContexts: [
        'Verify live ProofMode MCP with Playwright',
        'Verify production ProofMode MCP with Playwright',
      ],
      preMergeCandidateContext: 'Verify candidate ProofMode runtime with Playwright',
      preMergeCandidateIntegrationId: null,
      preMergeCandidateProducerTrust: 'external-github-app-check-required',
      preMergeCandidateWorkflowProvenance: 'must-not-be-pr-authored-github-actions-only',
      preMergeCandidateProducerEvidence: 'exact-head-check-run-app-identity-required',
      preMergeCandidateRulesetId: 20818149,
      preMergeCandidateRulesetName: 'Chief AI main exact-head gate',
      preMergeCandidateRulesetMustHaveNoBypassActors: true,
      preMergeCandidateReviewPolicy: {
        requiredApprovingReviewCount: 1,
        dismissStaleReviewsOnPush: true,
        requireLastPushApproval: true,
        requiredReviewThreadResolution: true,
      },
      preMergeCandidateScope: 'founder-authorized immutable-preview exact-SHA Playwright proof',
      postMergeProductionContext: 'Verify production ProofMode MCP with Playwright',
      postMergeProductionScope: 'current-main canonical-production exact-SHA Playwright proof',
      postMergeOnlyDeploymentEnvironments: ['Cloudflare Production'],
    });
    expect(operationalAuthority.proofContextSemantics.rulesetMigration).toMatch(/^HOLD:/);
    expect(operationalAuthority.proofContextSemantics.rulesetMigration).toContain('fresh approval');
    expect(operationalAuthority.proofContextSemantics.rulesetMigration).toContain('external GitHub App/check producer');
  });
});
