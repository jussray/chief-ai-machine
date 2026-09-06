import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new globalThis.URL(path, import.meta.url), 'utf8');
const capabilityWorkflow = read('../.github/workflows/chief-capability-plan-playwright.yml');
const accessAdminWorkflow = read('../.github/workflows/proofmode-access-service-auth.yml');
const proofModeWorkflow = read('../.github/workflows/proofmode-mcp-playwright.yml');
const productionWorkflow = read('../.github/workflows/proofmode-production-playwright.yml');
const operationalAuthority = JSON.parse(read('../config/operational-authority.json'));

describe('ProofMode privileged bootstrap membrane', () => {
  it('runs Access administration only from default-branch repository_dispatch source', () => {
    expect(accessAdminWorkflow).toContain('repository_dispatch:');
    expect(accessAdminWorkflow).toContain('types: [proofmode_access_admin]');
    expect(accessAdminWorkflow).not.toContain('workflow_call:');
    expect(accessAdminWorkflow).not.toContain('workflow_dispatch:');
    expect(accessAdminWorkflow).toContain('EVENT_REF: ${{ github.ref }}');
    expect(accessAdminWorkflow).toContain('if [ "$EVENT_NAME" != "repository_dispatch" ] || [ "$EVENT_REF" != "refs/heads/main" ]; then');
    expect(accessAdminWorkflow).toContain('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}');
    expect(accessAdminWorkflow).toContain('if [ "$EXPECTED_MAIN_SHA" != "$WORKFLOW_SHA" ]; then');
    expect(accessAdminWorkflow).toContain('if [ -z "$current" ] || [ "$current" != "$WORKFLOW_SHA" ]; then');
  });

  it('requires repository-owner authority for provider repair while allowing read-only check dispatch', () => {
    expect(accessAdminWorkflow).toContain('case "$REQUESTED_MODE" in');
    expect(accessAdminWorkflow).toContain('repair)');
    expect(accessAdminWorkflow).toContain('if [ "$DISPATCH_ACTOR" != "$REPOSITORY_OWNER" ]; then');
    expect(accessAdminWorkflow).toContain('Access repair is repository-owner only');
    expect(accessAdminWorkflow).toContain('check) ;;');
  });

  it('keeps provider secrets behind the trusted dispatch gate and rechecks main before provider access', () => {
    const guard = accessAdminWorkflow.indexOf('  dispatch-identity:');
    const protectedJob = accessAdminWorkflow.indexOf('  access-policy:');
    const environment = accessAdminWorkflow.indexOf('environment: proofmode-access-admin');
    const firstAdminSecret = accessAdminWorkflow.indexOf('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN: ${{ secrets.CLOUDFLARE_ACCESS_ADMIN_API_TOKEN }}');
    expect(guard).toBeGreaterThanOrEqual(0);
    expect(protectedJob).toBeGreaterThan(guard);
    expect(environment).toBeGreaterThan(protectedJob);
    expect(firstAdminSecret).toBeGreaterThan(environment);
    expect(accessAdminWorkflow).toContain('Main moved before provider access');
    expect(accessAdminWorkflow).toContain('ref: ${{ github.sha }}');
  });

  it('removes arbitrary-ref workflow_dispatch from candidate and production secret-bearing paths', () => {
    for (const workflow of [capabilityWorkflow, proofModeWorkflow, productionWorkflow]) {
      expect(workflow).not.toContain('workflow_dispatch:');
    }
    expect(capabilityWorkflow).toContain('repository_dispatch:');
    expect(capabilityWorkflow).toContain('types: [chief_candidate_runtime_evidence]');
    expect(proofModeWorkflow).toContain('repository_dispatch:');
    expect(proofModeWorkflow).toContain('types: [proofmode_candidate_runtime_evidence]');
    expect(productionWorkflow).toContain('push:');
    expect(productionWorkflow).toContain('branches: [main]');
  });

  it('keeps PR execution source-only while protected runtime evidence is main-dispatch only', () => {
    for (const workflow of [capabilityWorkflow, proofModeWorkflow]) {
      const sourceStart = workflow.indexOf('  source-contract:');
      const dispatchStart = workflow.indexOf('  dispatch-identity:');
      const evidenceStart = workflow.indexOf('  trusted-runtime-evidence:');
      expect(sourceStart).toBeGreaterThanOrEqual(0);
      expect(dispatchStart).toBeGreaterThan(sourceStart);
      expect(evidenceStart).toBeGreaterThan(dispatchStart);
      const sourceSection = workflow.slice(sourceStart, dispatchStart);
      expect(sourceSection).not.toContain('environment: proofmode-access-admin');
      expect(sourceSection).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
      expect(workflow.slice(dispatchStart, evidenceStart)).toContain("github.event_name == 'repository_dispatch'");
      expect(workflow.slice(evidenceStart)).toContain('environment: proofmode-access-admin');
      expect(workflow.slice(evidenceStart)).toContain('ref: ${{ github.sha }}');
    }
  });

  it('never lets GitHub Actions emit the reserved external candidate-authority context', () => {
    expect(proofModeWorkflow).not.toContain('Verify candidate ProofMode runtime with Playwright');
    expect(proofModeWorkflow).toContain('name: ProofMode trusted runtime evidence');
    expect(operationalAuthority.proofContextSemantics.preMergeCandidateContext)
      .toBe('Verify candidate ProofMode runtime with Playwright');
    expect(operationalAuthority.proofContextSemantics.preMergeCandidateProducerTrust)
      .toBe('external-github-app-check-required');
  });

  it('records the bootstrap as blocked until a current-main carrier exists', () => {
    expect(operationalAuthority.workflowRules).toMatchObject({
      candidateAuthoredWorkflowsMayConsumeProtectedSecrets: false,
      candidateAuthoredWorkflowsMayEnterProtectedEnvironment: false,
      privilegedWorkflowSourceMustEqualCurrentMain: true,
      stalePrivilegedWorkflowSourceFailsClosed: true,
      secretBearingWorkflowDispatchForbidden: true,
      providerAdminUsesDefaultBranchRepositoryDispatch: true,
    });
    expect(operationalAuthority.proofContextSemantics.privilegedBootstrap).toMatchObject({
      state: 'BLOCKED_UNTIL_TRUSTED_MAIN_CARRIER',
      trustedAdminWorkflowSha: null,
      trustedSourceRule: 'exact-current-main-only',
      trigger: 'repository_dispatch',
      candidateWorkflowMayInvokeAdmin: false,
      candidateWorkflowMayReadProtectedSecrets: false,
    });
  });
});
