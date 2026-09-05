import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateProofModeRulesetMigration } from '../scripts/verify-proofmode-ruleset.mjs';

const GITHUB_ACTIONS_INTEGRATION_ID = 15368;
const EXTERNAL_GITHUB_APP_INTEGRATION_ID = 424242;

function loadSemantics() {
  const config = JSON.parse(fs.readFileSync(new globalThis.URL('../config/operational-authority.json', import.meta.url), 'utf8'));
  return config.proofContextSemantics || {};
}

function candidateRuleset(semantics, integrationId) {
  const review = semantics.preMergeCandidateReviewPolicy || {};
  return {
    id: semantics.preMergeCandidateRulesetId,
    name: semantics.preMergeCandidateRulesetName,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    bypass_actors: [],
    rules: [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: review.requiredApprovingReviewCount,
          dismiss_stale_reviews_on_push: review.dismissStaleReviewsOnPush,
          require_last_push_approval: review.requireLastPushApproval,
          required_review_thread_resolution: review.requiredReviewThreadResolution,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: [{
            context: semantics.preMergeCandidateContext,
            integration_id: integrationId,
          }],
        },
      },
    ],
  };
}

describe('ProofMode candidate producer trust root', () => {
  it('does not treat PR-authored GitHub Actions as sufficient candidate-proof authority', () => {
    const semantics = loadSemantics();

    expect(semantics.preMergeCandidateIntegrationId).not.toBe(GITHUB_ACTIONS_INTEGRATION_ID);
    expect(semantics.preMergeCandidateProducerTrust).toBe('external-github-app-check-required');
    expect(semantics.preMergeCandidateWorkflowProvenance).toBe('must-not-be-pr-authored-github-actions-only');
  });

  it('keeps the migration on hold until an external producer integration is observed', () => {
    const semantics = loadSemantics();

    expect(semantics.preMergeCandidateIntegrationId).toBeNull();
    expect(semantics.rulesetMigration).toMatch(/^HOLD:/);
    expect(semantics.rulesetMigration).toContain('external GitHub App/check producer');
  });

  it('fails closed if GitHub Actions 15368 is restored as the sole candidate producer', () => {
    const semantics = {
      ...loadSemantics(),
      preMergeCandidateIntegrationId: GITHUB_ACTIONS_INTEGRATION_ID,
    };
    const result = validateProofModeRulesetMigration({
      rulesets: [candidateRuleset(semantics, GITHUB_ACTIONS_INTEGRATION_ID)],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.candidateRulesets).toEqual([]);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-proofmode-producer-untrusted',
        integrationId: GITHUB_ACTIONS_INTEGRATION_ID,
      }),
    ]));
  });

  it('allows a distinct external GitHub App only when the same no-bypass carrier, provenance contract, and fresh-review authority are preserved', () => {
    const semantics = {
      ...loadSemantics(),
      preMergeCandidateIntegrationId: EXTERNAL_GITHUB_APP_INTEGRATION_ID,
    };
    const result = validateProofModeRulesetMigration({
      rulesets: [candidateRuleset(semantics, EXTERNAL_GITHUB_APP_INTEGRATION_ID)],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.candidateRulesets).toEqual([{
      id: semantics.preMergeCandidateRulesetId,
      name: semantics.preMergeCandidateRulesetName,
    }]);
  });
});
