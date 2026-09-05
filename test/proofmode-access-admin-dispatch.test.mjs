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

describe('ProofMode Access admin dispatch bootstrap', () => {
  it('routes manual Access check/repair through a workflow that already exists on main', () => {
    expect(capabilityWorkflow).toContain('workflow_dispatch:');
    expect(capabilityWorkflow).toContain('access_mode:');
    expect(capabilityWorkflow).toContain('uses: ./.github/workflows/proofmode-access-service-auth.yml');
    expect(capabilityWorkflow).not.toContain('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN');
  });

  it('keeps provider credentials inside the protected reusable admin workflow', () => {
    expect(accessAdminWorkflow).toContain('workflow_call:');
    expect(accessAdminWorkflow).toContain('environment: proofmode-access-admin');
    expect(accessAdminWorkflow).toContain('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN');
    expect(accessAdminWorkflow).toContain('ref: ${{ github.sha }}');
    expect(accessAdminWorkflow).toContain('run: node scripts/proofmode-access-policy.mjs');
  });
});
