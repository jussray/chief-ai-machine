import { describe, expect, it } from 'vitest';
import { validateProofModeRulesetMigration } from '../scripts/verify-proofmode-ruleset.mjs';

const CANDIDATE_CONTEXT = 'Verify candidate ProofMode runtime with Playwright';
const EXTERNAL_APP_ID = 424242;

const founderApprovedReviewPolicy = Object.freeze({
  requiredApprovingReviewCount: 0,
  dismissStaleReviewsOnPush: false,
  requireLastPushApproval: false,
  requiredReviewThreadResolution: true,
});

const semantics = Object.freeze({
  legacyPreMergeProofModeContexts: [
    'Verify live ProofMode MCP with Playwright',
    'Verify production ProofMode MCP with Playwright',
  ],
  preMergeCandidateContext: CANDIDATE_CONTEXT,
  preMergeCandidateIntegrationId: EXTERNAL_APP_ID,
  preMergeCandidateProducerTrust: 'external-github-app-check-required',
  preMergeCandidateWorkflowProvenance: 'must-not-be-pr-authored-github-actions-only',
  preMergeCandidateRulesetId: 20818149,
  preMergeCandidateRulesetName: 'Chief AI main exact-head gate',
  preMergeCandidateRulesetMustHaveNoBypassActors: true,
  preMergeCandidateReviewPolicy: founderApprovedReviewPolicy,
  postMergeOnlyDeploymentEnvironments: [],
});

function carrier({ reviewPolicy = founderApprovedReviewPolicy } = {}) {
  return {
    id: 20818149,
    name: 'Chief AI main exact-head gate',
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    bypass_actors: [],
    rules: [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: reviewPolicy.requiredApprovingReviewCount,
          dismiss_stale_reviews_on_push: reviewPolicy.dismissStaleReviewsOnPush,
          require_last_push_approval: reviewPolicy.requireLastPushApproval,
          required_review_thread_resolution: reviewPolicy.requiredReviewThreadResolution,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: [
            { context: CANDIDATE_CONTEXT, integration_id: EXTERNAL_APP_ID },
          ],
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

function legacyBoundary() {
  return {
    id: 21261587,
    name: 'governance boundary',
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
    bypass_actors: [{ actor_type: 'RepositoryRole', actor_id: 5, bypass_mode: 'always' }],
    rules: [
      {
        type: 'pull_request',
        parameters: {
          required_approving_review_count: 0,
          dismiss_stale_reviews_on_push: true,
          require_last_push_approval: true,
          required_review_thread_resolution: true,
        },
      },
      {
        type: 'required_status_checks',
        parameters: {
          required_status_checks: [
            { context: 'Verify live ProofMode MCP with Playwright', integration_id: 15368 },
            { context: 'Verify production ProofMode MCP with Playwright', integration_id: 15368 },
          ],
        },
      },
    ],
  };
}

describe('founder-approved existing ruleset topology', () => {
  it('accepts the configured zero-approval founder topology without requiring a ruleset rewrite', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [carrier()],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(true);
    expect(result.candidateReviewPolicy).toEqual(founderApprovedReviewPolicy);
    expect(result.postMergeOnlyDeploymentEnvironments).toEqual([]);
    expect(result.violations).toEqual([]);
  });

  it('still fails closed when the founder-approved review topology drifts', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [carrier({
        reviewPolicy: {
          ...founderApprovedReviewPolicy,
          requiredReviewThreadResolution: false,
        },
      })],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-proofmode-review-authority-weak',
        expectedRulesetId: 20818149,
      }),
    ]));
  });

  it('does not hide conflicting legacy requirements in another active default-branch ruleset', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [carrier(), legacyBoundary()],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'legacy-proofmode-context-still-required',
        context: 'Verify live ProofMode MCP with Playwright',
        rulesets: expect.arrayContaining([
          expect.objectContaining({ id: 21261587, name: 'governance boundary' }),
        ]),
      }),
      expect.objectContaining({
        classification: 'legacy-proofmode-context-still-required',
        context: 'Verify production ProofMode MCP with Playwright',
      }),
    ]));
  });
});
