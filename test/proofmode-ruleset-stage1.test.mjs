import { describe, expect, it } from 'vitest';
import { compileProofModeRulesetStage1 } from '../scripts/compile-proofmode-ruleset-stage1.mjs';

function liveCarrier() {
  return {
    id: 20818149,
    name: 'Chief AI main exact-head gate',
    target: 'branch',
    enforcement: 'active',
    conditions: {
      ref_name: {
        exclude: [],
        include: ['~DEFAULT_BRANCH'],
      },
    },
    bypass_actors: [],
    rules: [
      { type: 'deletion' },
      { type: 'non_fast_forward' },
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: false,
          required_reviewers: [],
          require_code_owner_review: false,
          require_last_push_approval: false,
          required_review_thread_resolution: true,
          require_extra_approval_for_unattributed_changes: true,
          allowed_merge_methods: ['merge', 'squash', 'rebase'],
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: false,
          do_not_enforce_on_create: false,
          required_status_checks: [
            { context: 'Typecheck' },
            { context: 'Lint' },
            { context: 'Unit Tests' },
            { context: 'SonarQube – Founder Intelligence' },
            { context: 'Verify test-ledger contract' },
          ],
        },
      },
      { type: 'required_linear_history' },
      {
        type: 'code_scanning',
        parameters: {
          code_scanning_tools: [{
            tool: 'CodeQL',
            security_alerts_threshold: 'high_or_higher',
            alerts_threshold: 'errors',
          }],
        },
      },
      {
        type: 'required_deployments',
        parameters: {
          required_deployment_environments: ['Cloudflare Production', 'proofmode-access-admin'],
        },
      },
    ],
  };
}

describe('ProofMode ruleset stage1 approved-carrier validator', () => {
  it('accepts the founder-approved live ruleset without proposing a mutation', () => {
    const receipt = compileProofModeRulesetStage1({ ruleset: liveCarrier() });

    expect(receipt.status).toBe('already-compliant');
    expect(receipt.rulesetId).toBe(20818149);
    expect(receipt.mutation).toBeNull();
    expect(receipt.observedFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(receipt.desiredFingerprint).toBe(receipt.observedFingerprint);
    expect(receipt.reviewAuthority).toEqual({
      reviewer: 'founder',
      githubSelfApprovalRequired: false,
      githubLastPusherApprovalRequired: false,
      finalReviewRequiredBeforeMergeDecision: true,
    });
    expect(receipt.invariants).toEqual({
      zeroBypassActorsPreserved: true,
      conditionsPreserved: true,
      statusChecksPreserved: true,
      requiredDeploymentsPreserved: true,
      reservedCandidateContextRemainsUnbound: true,
      founderReviewAuthorityPreserved: true,
      liveRulesetAcceptedAsAuthority: true,
      mutationRequired: false,
    });
  });

  it('fails closed if the carrier is bypassable or bypass state is hidden', () => {
    const bypassable = liveCarrier();
    bypassable.bypass_actors = [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }];
    expect(compileProofModeRulesetStage1({ ruleset: bypassable })).toMatchObject({
      status: 'blocked',
      mutation: null,
    });
    expect(compileProofModeRulesetStage1({ ruleset: bypassable }).violations)
      .toContainEqual(expect.objectContaining({ classification: 'ruleset-bypass-actors-present' }));

    const hidden = liveCarrier();
    delete hidden.bypass_actors;
    expect(compileProofModeRulesetStage1({ ruleset: hidden }).violations)
      .toContainEqual(expect.objectContaining({ classification: 'ruleset-bypass-state-unobservable' }));
  });

  it('refuses the wrong carrier or a carrier that no longer targets the protected default branch', () => {
    const wrong = liveCarrier();
    wrong.id = 21261587;
    expect(compileProofModeRulesetStage1({ ruleset: wrong }).violations)
      .toContainEqual(expect.objectContaining({ classification: 'wrong-ruleset-carrier' }));

    const retargeted = liveCarrier();
    retargeted.conditions.ref_name.include = ['refs/heads/other'];
    expect(compileProofModeRulesetStage1({ ruleset: retargeted }).violations)
      .toContainEqual(expect.objectContaining({ classification: 'ruleset-default-branch-target-mismatch' }));
  });

  it('fails closed if candidate authority appears or baseline checks drift', () => {
    const premature = liveCarrier();
    premature.rules.find((entry) => entry.type === 'required_status_checks')
      .parameters.required_status_checks.push({ context: 'Verify candidate ProofMode runtime with Playwright', integration_id: 999 });
    expect(compileProofModeRulesetStage1({ ruleset: premature }).violations)
      .toContainEqual(expect.objectContaining({ classification: 'reserved-candidate-context-already-required' }));

    const missingBaseline = liveCarrier();
    missingBaseline.rules.find((entry) => entry.type === 'required_status_checks')
      .parameters.required_status_checks = [{ context: 'Typecheck' }];
    const classifications = compileProofModeRulesetStage1({ ruleset: missingBaseline }).violations
      .map((item) => item.classification);
    expect(classifications).toContain('baseline-required-status-missing');
  });

  it('fails closed if GitHub review settings drift into a second-reviewer requirement', () => {
    const drifted = liveCarrier();
    const pullRequest = drifted.rules.find((entry) => entry.type === 'pull_request');
    pullRequest.parameters.required_approving_review_count = 1;
    pullRequest.parameters.dismiss_stale_reviews_on_push = true;
    pullRequest.parameters.require_last_push_approval = true;

    const receipt = compileProofModeRulesetStage1({ ruleset: drifted });
    expect(receipt.status).toBe('blocked');
    expect(receipt.mutation).toBeNull();
    expect(receipt.violations)
      .toContainEqual(expect.objectContaining({ classification: 'founder-review-model-drift' }));
  });

  it('fails closed if either approved deployment requirement is removed or an extra one appears', () => {
    const missing = liveCarrier();
    missing.rules.find((entry) => entry.type === 'required_deployments')
      .parameters.required_deployment_environments = ['proofmode-access-admin'];
    expect(compileProofModeRulesetStage1({ ruleset: missing }).violations)
      .toContainEqual(expect.objectContaining({
        classification: 'required-deployment-missing',
        environment: 'Cloudflare Production',
      }));

    const extra = liveCarrier();
    extra.rules.find((entry) => entry.type === 'required_deployments')
      .parameters.required_deployment_environments.push('unapproved-environment');
    expect(compileProofModeRulesetStage1({ ruleset: extra }).violations)
      .toContainEqual(expect.objectContaining({ classification: 'required-deployment-topology-drift' }));
  });
});
