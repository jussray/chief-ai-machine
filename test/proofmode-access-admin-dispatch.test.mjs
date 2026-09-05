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

const TRUSTED_ADMIN_SHA = '18768db9618ad925f6be7c263e0bce7fd5860929';
const TRUSTED_ADMIN_CALL = `uses: jussray/chief-ai-machine/.github/workflows/proofmode-access-service-auth.yml@${TRUSTED_ADMIN_SHA}`;

describe('ProofMode Access admin dispatch bootstrap', () => {
  it('routes Access check/repair through an immutable reusable admin revision', () => {
    expect(capabilityWorkflow).toContain('workflow_dispatch:');
    expect(capabilityWorkflow).toContain('access_mode:');
    expect(capabilityWorkflow).toContain(TRUSTED_ADMIN_CALL);
    expect(capabilityWorkflow).not.toContain('uses: ./.github/workflows/proofmode-access-service-auth.yml');
    expect(capabilityWorkflow).not.toContain('secrets: inherit');
    expect(capabilityWorkflow).toContain('CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}');
    expect(capabilityWorkflow).toContain('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN: ${{ secrets.CLOUDFLARE_ACCESS_ADMIN_API_TOKEN }}');
    expect(capabilityWorkflow).toContain('CLOUDFLARE_ACCESS_CLIENT_ID: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}');
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

  it('declares only the Cloudflare secrets required by the admin policy evaluator', () => {
    for (const secret of [
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_ACCESS_ADMIN_API_TOKEN',
      'CLOUDFLARE_ACCESS_CLIENT_ID',
    ]) {
      expect(accessAdminWorkflow).toContain(`${secret}:\n        required: true`);
    }
    expect(accessAdminWorkflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
  });
});