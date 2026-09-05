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

const TRUSTED_ADMIN_SHA = '988e2ac70d5d8d0c1988a373aae419c2f9b63b59';
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

  it('keeps privileged Access admin work manual and scoped to the normalized immutable target', () => {
    expect(capabilityWorkflow).toContain("if: ${{ github.event_name == 'workflow_dispatch' && inputs.access_mode != 'verify' }}");
    expect(capabilityWorkflow).toContain('mode: ${{ inputs.access_mode }}');
    expect(capabilityWorkflow).toContain('target_url: ${{ needs.dispatch-identity.outputs.base_url }}');
    expect(capabilityWorkflow).not.toContain('target_url: ${{ inputs.base_url }}');
    expect(capabilityWorkflow).not.toContain('github.event.pull_request.number == 143');
    expect(capabilityWorkflow).not.toContain('https://0a541f03-chief-ai.mcgill-raylene.workers.dev');
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

  it('sources admin credentials only from the protected environment job', () => {
    expect(accessAdminWorkflow).not.toContain('    secrets:\n      CLOUDFLARE_ACCOUNT_ID:');
    for (const secret of [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_ACCESS_ADMIN_API_TOKEN',
      'CLOUDFLARE_ACCESS_CLIENT_ID',
    ]) {
      expect(accessAdminWorkflow).toContain(`${secret}: \${{ secrets.${secret} }}`);
    }
    expect(accessAdminWorkflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
  });
});