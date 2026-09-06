import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluatePrivilegedBootstrap } from '../scripts/verify-privileged-bootstrap.mjs';

const read = (path) => readFileSync(new globalThis.URL(path, import.meta.url), 'utf8');
const capability = read('../.github/workflows/chief-capability-plan-playwright.yml');
const proofMode = read('../.github/workflows/proofmode-mcp-playwright.yml');
const admin = read('../.github/workflows/proofmode-access-service-auth.yml');
const production = read('../.github/workflows/proofmode-production-playwright.yml');
const authority = JSON.parse(read('../config/operational-authority.json'));
const OLD_UNTRUSTED_PIN = 'c1acda4363099b7233d5857e8d2e4c97163ef42d';
const workflows = { capability, proofMode, admin, production };

describe('privileged bootstrap provenance', () => {
  it('eradicates the historical candidate-descendant admin pin', () => {
    for (const text of [capability, proofMode, admin, production, JSON.stringify(authority)]) {
      expect(text).not.toContain(OLD_UNTRUSTED_PIN);
    }
  });

  it('forbids arbitrary-ref manual dispatch wherever protected runtime/provider secrets exist', () => {
    for (const text of [capability, proofMode, admin, production]) {
      expect(text).not.toContain('workflow_dispatch:');
    }
    expect(admin).toContain('repository_dispatch:');
    expect(capability).toContain('repository_dispatch:');
    expect(proofMode).toContain('repository_dispatch:');
    expect(production).toContain('push:');
    expect(production).not.toContain('repository_dispatch:');
  });

  it('requires exact-current-main re-observation before every protected provider/runtime job', () => {
    for (const text of [admin, capability, proofMode, production]) {
      expect(text).toContain('environment: proofmode-access-admin');
      expect(text).toContain('branches/main');
      expect(text).toContain('$GITHUB_SHA');
    }
    expect(admin).toContain('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}');
    expect(capability).toContain('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}');
    expect(proofMode).toContain('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}');
  });

  it('keeps candidate source checkout before, and separate from, any protected evidence job', () => {
    for (const text of [capability, proofMode]) {
      const source = text.indexOf('  source-contract:');
      const protectedEvidence = text.indexOf('  trusted-runtime-evidence:');
      expect(source).toBeGreaterThanOrEqual(0);
      expect(protectedEvidence).toBeGreaterThan(source);
      expect(text.slice(source, protectedEvidence)).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
      expect(text.slice(source, protectedEvidence)).not.toContain('environment: proofmode-access-admin');
      expect(text.slice(protectedEvidence)).toContain('ref: ${{ github.sha }}');
      expect(text.slice(protectedEvidence)).not.toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    }
  });

  it('keeps repair authority narrower than read-only provider inspection', () => {
    expect(admin).toContain('check) ;;');
    expect(admin).toContain('repair)');
    expect(admin).toContain('if [ "$DISPATCH_ACTOR" != "$REPOSITORY_OWNER" ]; then');
    expect(admin).toContain('Access repair is repository-owner only');
  });

  it('keeps GitHub Actions evidence distinct from the reserved external candidate authority context', () => {
    expect(proofMode).not.toContain(authority.proofContextSemantics.preMergeCandidateContext);
    expect(proofMode).toContain('ProofMode trusted runtime evidence');
    expect(authority.proofContextSemantics.preMergeCandidateIntegrationId).toBeNull();
    expect(authority.proofContextSemantics.preMergeCandidateProducerTrust)
      .toBe('external-github-app-check-required');
  });

  it('records bootstrap as blocked until this carrier actually exists on current protected main', () => {
    const bootstrap = authority.proofContextSemantics.privilegedBootstrap;
    expect(bootstrap.state).toBe('BLOCKED_UNTIL_TRUSTED_MAIN_CARRIER');
    expect(bootstrap.trustedAdminWorkflowSha).toBeNull();
    expect(bootstrap.trustedSourceRule).toBe('exact-current-main-only');
    expect(bootstrap.trigger).toBe('repository_dispatch');
    expect(bootstrap.candidateWorkflowMayInvokeAdmin).toBe(false);
    expect(bootstrap.candidateWorkflowMayReadProtectedSecrets).toBe(false);
  });

  it('Attack 3000 separates secure architecture from operational realizability', () => {
    const report = evaluatePrivilegedBootstrap({ authority, workflows });

    expect(report.ok).toBe(true);
    expect(report.attack3000).toMatchObject({
      contract: 'chief/attack3000@v1',
      purpose: 'operational-realizability',
      pressureDepth: 3000,
      literalExternalActionsClaimed: 0,
      operationalState: 'BLOCKED',
      sourceContractValid: true,
      architectureSecure: true,
      ruleset208Mode: 'use-as-is',
      rulesetMutationSuggested: false,
      bypassSuggested: false,
      candidateSecretEscalationSuggested: false,
      dummyReceiptAllowed: false,
      providerBuildCanSatisfyRuntimeTruth: false,
      liveProofStillRequired: true,
    });
    expect(report.attack3000.blockers).toContain('trusted-main-privileged-carrier-not-active');
    expect(report.attack3000.blockers).toContain('external-candidate-runtime-producer-unbound');
  });

  it('Attack 3000 pins the full outcome chain and forbids fake exits', () => {
    const attack3000 = authority.proofContextSemantics.attack3000;

    expect(attack3000.requiredOutcomeChain).toEqual([
      'external-candidate-producer-bound-to-exact-head',
      'trusted-provider-readback',
      'proofmode-access-admin-deployment-evidence',
      'exact-runtime-version',
      'protected-playwright',
      'fresh-founder-review',
    ]);
    expect(attack3000.forbiddenShortcuts).toEqual([
      'weaken-ruleset-208',
      'dummy-deployment-or-check-receipt',
      'candidate-secret-escalation',
      'provider-build-as-runtime-or-outcome-truth',
    ]);
  });

  it('fails the source contract if Attack 3000 is rewritten to weaken ruleset 208', () => {
    const mutatedAuthority = JSON.parse(JSON.stringify(authority));
    mutatedAuthority.proofContextSemantics.attack3000.rulesetMutationAllowed = true;

    const report = evaluatePrivilegedBootstrap({ authority: mutatedAuthority, workflows });

    expect(report.ok).toBe(false);
    expect(report.attack3000.operationalState).toBe('INVALID');
    expect(report.attack3000.rulesetMutationSuggested).toBe(false);
    expect(report.violations).toContainEqual(expect.objectContaining({
      classification: 'attack3000-contract-mismatch',
      rule: 'rulesetMutationAllowed',
      expected: false,
      actual: true,
    }));
  });
});
