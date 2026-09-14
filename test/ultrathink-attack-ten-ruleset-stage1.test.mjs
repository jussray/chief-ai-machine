import { describe, expect, it } from 'vitest';
import { compileProofModeRulesetStage1 } from '../scripts/compile-proofmode-ruleset-stage1.mjs';
import { evaluateUltrathinkAttackTenRulesetStage1 } from '../scripts/ultrathink-attack-ten-ruleset-stage1.mjs';

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

function mutableState(ruleset) {
  return {
    name: ruleset.name,
    target: ruleset.target,
    enforcement: ruleset.enforcement,
    bypass_actors: ruleset.bypass_actors,
    conditions: ruleset.conditions,
    rules: ruleset.rules,
  };
}

describe('ULTRATHINK Attack Ten stage1 governance gate', () => {
  it('passes all ten falsifiers when the founder-approved live ruleset is preserved exactly', () => {
    const receipt = compileProofModeRulesetStage1({ ruleset: liveCarrier() });

    expect(receipt.status).toBe('already-compliant');
    expect(receipt.attackTen).toMatchObject({
      protocol: 'ultrathink-attack-ten/ruleset-stage1@v2',
      status: 'passed',
      passedCount: 10,
      attackCount: 10,
    });
    expect(receipt.attackTen.attacks).toHaveLength(10);
    expect(receipt.attackTen.attacks.every((entry) => entry.status === 'passed')).toBe(true);
    expect(receipt.mutation).toBeNull();
  });

  it('falsifies any desired state that changes unrelated authority', () => {
    const observed = liveCarrier();
    const drifted = JSON.parse(JSON.stringify(mutableState(observed)));
    drifted.conditions.ref_name.include.push('refs/heads/unrelated-authority-expansion');
    drifted.rules.find((entry) => entry.type === 'required_status_checks')
      .parameters.required_status_checks.push({ context: 'Unapproved authority context' });

    const attackTen = evaluateUltrathinkAttackTenRulesetStage1({
      observedRuleset: observed,
      desiredRuleset: drifted,
    });

    expect(attackTen.status).toBe('failed');
    expect(attackTen.attacks)
      .toContainEqual(expect.objectContaining({
        id: 'ATK-10-no-governance-mutation',
        status: 'failed',
      }));
  });

  it('fails closed when founder review topology drifts', () => {
    const observed = liveCarrier();
    const review = observed.rules.find((entry) => entry.type === 'pull_request').parameters;
    review.required_approving_review_count = 1;
    review.dismiss_stale_reviews_on_push = true;
    review.require_last_push_approval = true;

    const receipt = compileProofModeRulesetStage1({ ruleset: observed });

    expect(receipt.status).toBe('blocked');
    expect(receipt.attackTen.status).toBe('failed');
    expect(receipt.attackTen.attacks)
      .toContainEqual(expect.objectContaining({
        id: 'ATK-09-founder-review-topology-intact',
        status: 'failed',
      }));
  });

  it('fails closed when bypass actors appear or candidate authority is prematurely bound', () => {
    const observed = liveCarrier();
    observed.bypass_actors = [{ actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' }];
    observed.rules.find((entry) => entry.type === 'required_status_checks')
      .parameters.required_status_checks.push({
        context: 'Verify candidate ProofMode runtime with Playwright',
        integration_id: 999,
      });

    const receipt = compileProofModeRulesetStage1({ ruleset: observed });

    expect(receipt.status).toBe('blocked');
    expect(receipt.mutation).toBeNull();
    expect(receipt.attackTen.status).toBe('failed');
    expect(receipt.attackTen.attacks)
      .toContainEqual(expect.objectContaining({ id: 'ATK-04-zero-bypass-visible', status: 'failed' }));
    expect(receipt.attackTen.attacks)
      .toContainEqual(expect.objectContaining({ id: 'ATK-07-candidate-authority-unbound', status: 'failed' }));
  });
});
