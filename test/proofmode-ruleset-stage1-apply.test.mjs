import { describe, expect, it } from 'vitest';
import { compileProofModeRulesetStage1 } from '../scripts/compile-proofmode-ruleset-stage1.mjs';
import {
  applyProofModeRulesetStage1,
  buildProofModeRulesetStage1FailureReceipt,
  PROOFMODE_RULESET_STAGE1,
  verifyTrustedRulesetRepairSource,
} from '../scripts/apply-proofmode-ruleset-stage1.mjs';

const REPOSITORY = 'jussray/chief-ai-machine';
const TRUSTED_SOURCE_SHA = 'a'.repeat(40);
const EXPECTED_FINGERPRINT = '5758b4b5aba90895fc3639c4afff2459bc479a13293dc4a589a7829bc0345738';

function baselineRuleset() {
  return {
    id: 20818149,
    name: 'Chief AI main exact-head gate',
    target: 'branch',
    source_type: 'Repository',
    source: REPOSITORY,
    enforcement: 'active',
    bypass_actors: [],
    conditions: {
      ref_name: {
        exclude: [],
        include: ['~DEFAULT_BRANCH'],
      },
    },
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
        type: 'copilot_code_review',
        parameters: {
          review_on_push: false,
          review_draft_pull_requests: true,
        },
      },
      {
        type: 'code_quality',
        parameters: { severity: 'errors' },
      },
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
        type: 'code_coverage',
        parameters: { minimum_coverage: null, max_coverage_drop: null },
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

function envFor(overrides = {}) {
  return {
    GITHUB_REPOSITORY: REPOSITORY,
    GITHUB_RULESET_ADMIN_TOKEN: 'admin-secret-token',
    PROOFMODE_RULESET_MODE: 'check',
    ...overrides,
  };
}

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return payload == null ? '' : JSON.stringify(payload);
    },
  };
}

describe('ProofMode ruleset stage-1 read-only verifier', () => {
  it('pins the approved live fingerprint and disables governance mutation', () => {
    const compiled = compileProofModeRulesetStage1({ ruleset: baselineRuleset(), repository: REPOSITORY });
    expect(compiled.status).toBe('already-compliant');
    expect(compiled.mutation).toBeNull();
    expect(compiled.observedFingerprint).toBe(EXPECTED_FINGERPRINT);
    expect(compiled.desiredFingerprint).toBe(EXPECTED_FINGERPRINT);
    expect(PROOFMODE_RULESET_STAGE1).toEqual({
      repository: REPOSITORY,
      rulesetId: 20818149,
      expectedObservedFingerprint: EXPECTED_FINGERPRINT,
      expectedDesiredFingerprint: EXPECTED_FINGERPRINT,
      mutationPolicy: 'disabled-current-ruleset-approved',
      repairSource: 'clean-current-main-only',
    });
  });

  it('check mode performs one GET and verifies the current ruleset without mutation', async () => {
    const calls = [];
    const receipt = await applyProofModeRulesetStage1({
      env: envFor(),
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return response(baselineRuleset());
      },
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].options.method).toBe('GET');
    expect(receipt).toEqual(expect.objectContaining({
      status: 'already-applied',
      mutationAttempted: false,
      providerAccepted: false,
      mutated: false,
      outcomeVerified: true,
      observedFingerprint: EXPECTED_FINGERPRINT,
      desiredFingerprint: EXPECTED_FINGERPRINT,
      verifiedFingerprint: EXPECTED_FINGERPRINT,
      authority: 'founder-approved-live-ruleset',
    }));
    expect(JSON.stringify(receipt)).not.toContain('admin-secret-token');
  });

  it('repair mode is also read-only when the founder-approved carrier is current', async () => {
    const methods = [];
    const receipt = await applyProofModeRulesetStage1({
      env: envFor({ PROOFMODE_RULESET_MODE: 'repair' }),
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return response(baselineRuleset());
      },
    });

    expect(methods).toEqual(['GET']);
    expect(receipt).toEqual(expect.objectContaining({
      mode: 'repair',
      status: 'already-applied',
      mutationAttempted: false,
      mutated: false,
      outcomeVerified: true,
    }));
  });

  it('fails closed on live governance drift and records no mutation attempt', async () => {
    const drifted = baselineRuleset();
    drifted.rules.find((entry) => entry.type === 'required_deployments')
      .parameters.required_deployment_environments = ['proofmode-access-admin'];

    let thrown;
    try {
      await applyProofModeRulesetStage1({
        env: envFor(),
        fetchImpl: async () => response(drifted),
      });
    } catch (error) {
      thrown = error;
    }

    expect(String(thrown)).toMatch(/validator blocked live ruleset/);
    const failure = buildProofModeRulesetStage1FailureReceipt({ env: envFor(), error: thrown });
    expect(failure).toEqual(expect.objectContaining({
      status: 'blocked',
      mutationAttempted: false,
      providerAccepted: false,
      mutated: false,
      outcomeVerified: false,
    }));
  });

  it('keeps clean-current-main provenance available without using it to self-authorize mutation', async () => {
    const fetchCalls = [];
    const fetchImpl = async (url, options) => {
      fetchCalls.push({ url, options });
      return response({ commit: { sha: TRUSTED_SOURCE_SHA } });
    };

    await expect(verifyTrustedRulesetRepairSource({
      fetchImpl,
      token: 'admin-secret-token',
      gitProbe: async () => ({ head: TRUSTED_SOURCE_SHA, cleanCheckout: false }),
    })).rejects.toThrow(/checkout must be clean/);
    expect(fetchCalls).toHaveLength(0);

    await expect(verifyTrustedRulesetRepairSource({
      fetchImpl,
      token: 'admin-secret-token',
      gitProbe: async () => ({ head: 'b'.repeat(40), cleanCheckout: true }),
    })).rejects.toThrow(/not current protected main/);

    const trusted = await verifyTrustedRulesetRepairSource({
      fetchImpl,
      token: 'admin-secret-token',
      gitProbe: async () => ({ head: TRUSTED_SOURCE_SHA, cleanCheckout: true }),
    });
    expect(trusted).toEqual({
      branch: 'main',
      sourceSha: TRUSTED_SOURCE_SHA,
      currentMainSha: TRUSTED_SOURCE_SHA,
      cleanCheckout: true,
    });
  });

  it('refuses to retarget the verifier to another repository', async () => {
    await expect(applyProofModeRulesetStage1({
      env: envFor({ GITHUB_REPOSITORY: 'someone/else' }),
      fetchImpl: async () => response({}),
    })).rejects.toThrow(/pinned to jussray\/chief-ai-machine/);
  });
});
