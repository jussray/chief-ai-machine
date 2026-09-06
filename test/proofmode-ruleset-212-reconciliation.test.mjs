import crypto from 'node:crypto';
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const PLAN_URL = new globalThis.URL(
  '../artifacts/proofmode/ruleset-212-reconciliation-plan.json',
  import.meta.url,
);

const LEGACY_CONTEXTS = [
  'Redacted provider receipt',
  'Verify exact Chief runtime with Playwright',
  'Verify live Chief capability plan with Playwright',
  'Verify live ProofMode MCP with Playwright',
  'Verify operational authority',
  'Verify production ProofMode MCP with Playwright',
];

const RETAINED_CONTEXTS = [
  'Publish exact-head test ledger',
  'Typecheck',
  'Verify Founder Goals desktop and mobile flow',
  'Verify Freestyle, Goalfix, and PromptOS in Chromium',
];

const OBSERVED_RULES_FINGERPRINT = 'b63e86fbe27dcf4b0a806f39ad42c9f25f53031c74806c58ce96968f3fcab4f0';
const DESIRED_RULES_FINGERPRINT = '95f46942ff05b04fdfd724d76939b86885aa6bbc95763a11c3e3914a3866f2f0';

function loadPlan() {
  return JSON.parse(fs.readFileSync(PLAN_URL, 'utf8'));
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

describe('ruleset 212 independent-admin reconciliation plan', () => {
  it('keeps candidate code inert and forbids bypass or protected-secret authority', () => {
    const plan = loadPlan();

    expect(plan.status).toBe('ready-for-independent-admin-reconciliation');
    expect(plan.authority).toMatchObject({
      mutationAuthority: 'independent-repository-admin-only',
      candidateCodeMayMutate: false,
      candidateCodeMayUseBypass: false,
      candidateCodeRole: 'compile-verify-and-fail-closed-only',
      protectedSecretsAllowed: false,
    });
    expect(plan.attack1000).toMatchObject({
      candidateSelfAuthorization: 'blocked',
      bypassUse: 'forbidden',
      protectedSecretExposure: 'forbidden',
      providerAcceptanceUpgradesOutcomeTruth: false,
    });
  });

  it('pins the observed carrier and fails closed on any live rules drift', () => {
    const plan = loadPlan();

    expect(plan.rulesetId).toBe(21261587);
    expect(plan.rulesetName).toBe('governance boundary');
    expect(plan.preconditions).toMatchObject({
      target: 'branch',
      enforcement: 'active',
      defaultBranchMustBeTargeted: true,
      observedRulesFingerprint: OBSERVED_RULES_FINGERPRINT,
      rulesFingerprintScope: 'rules-array-only-stable-json-sha256',
      reobserveImmediatelyBeforeMutation: true,
      abortOnAnyRulesFingerprintDrift: true,
      ruleset20818149MustRemainUnchanged: true,
    });
    expect(plan.preconditions.legacyContextsPresent).toEqual(LEGACY_CONTEXTS);
    expect(plan.preconditions.retainedContextsPresent).toEqual(RETAINED_CONTEXTS);
  });

  it('uses only the rules field so unrelated top-level ruleset state is not proposed for mutation', () => {
    const plan = loadPlan();

    expect(plan.mutation).toMatchObject({
      method: 'PUT',
      apiVersion: '2026-03-10',
      path: '/repos/jussray/chief-ai-machine/rulesets/21261587',
    });
    expect(Object.keys(plan.mutation.body)).toEqual(['rules']);
    expect(plan.mutation.body).not.toHaveProperty('bypass_actors');
    expect(plan.mutation.body).not.toHaveProperty('conditions');
    expect(plan.mutation.body).not.toHaveProperty('name');
    expect(plan.mutation.body).not.toHaveProperty('target');
    expect(plan.mutation.body).not.toHaveProperty('enforcement');
    expect(plan.desired.preserveUnrelatedTopLevelRulesetStateByOmission).toBe(true);
  });

  it('removes exactly the obsolete pre-merge authority contexts while retaining the source/browser checks', () => {
    const plan = loadPlan();
    const statusRule = plan.mutation.body.rules.find((rule) => rule.type === 'required_status_checks');
    const checks = statusRule.parameters.required_status_checks;

    expect(checks.map((check) => check.context)).toEqual(RETAINED_CONTEXTS);
    expect(checks.every((check) => check.integration_id === 15368)).toBe(true);
    expect(plan.desired.removeLegacyContexts).toEqual(LEGACY_CONTEXTS);
    expect(plan.desired.preserveRequiredContexts).toEqual(RETAINED_CONTEXTS);
    for (const context of LEGACY_CONTEXTS) {
      expect(checks.some((check) => check.context === context)).toBe(false);
    }
    expect(plan.desired.productionProofRemainsPostMergeOnly).toBe(true);
  });

  it('removes the solo-founder last-push deadlock without deleting review-thread protection', () => {
    const plan = loadPlan();
    const pullRequestRule = plan.mutation.body.rules.find((rule) => rule.type === 'pull_request');

    expect(pullRequestRule.parameters).toMatchObject({
      required_approving_review_count: 0,
      dismiss_stale_reviews_on_push: true,
      require_last_push_approval: false,
      required_review_thread_resolution: true,
      require_extra_approval_for_unattributed_changes: true,
    });
    expect(plan.desired).toMatchObject({
      requireLastPushApproval: false,
      requiredApprovingReviewCount: 0,
      requiredReviewThreadResolution: true,
    });
  });

  it('preserves deletion, non-fast-forward, linear-history, code-scanning, and Copilot review rules', () => {
    const plan = loadPlan();
    const types = plan.mutation.body.rules.map((rule) => rule.type);

    expect(types).toEqual([
      'deletion',
      'non_fast_forward',
      'required_linear_history',
      'pull_request',
      'required_status_checks',
      'code_scanning',
      'copilot_code_review',
    ]);
    expect(plan.attack1000).toMatchObject({
      codeScanningPreserved: true,
      linearHistoryPreserved: true,
      deletionProtectionPreserved: true,
      nonFastForwardProtectionPreserved: true,
    });
  });

  it('recomputes the exact desired rules fingerprint and requires independent readback', () => {
    const plan = loadPlan();
    const actualDesiredFingerprint = fingerprint(plan.mutation.body.rules);

    expect(actualDesiredFingerprint).toBe(DESIRED_RULES_FINGERPRINT);
    expect(plan.desired.rulesFingerprint).toBe(actualDesiredFingerprint);
    expect(plan.verification.desiredRulesFingerprintRequired).toBe(actualDesiredFingerprint);
    expect(plan.verification).toMatchObject({
      independentGetReadbackRequired: true,
      allLegacyContextsMustBeAbsent: true,
      allRetainedContextsMustRemain: true,
      lastPushApprovalMustBeFalse: true,
      ruleset20818149MustBeReobservedUnchanged: true,
      ambiguousWriteOutcome: 'reconcile-by-independent-readback-before-any-retry',
    });
  });
});
