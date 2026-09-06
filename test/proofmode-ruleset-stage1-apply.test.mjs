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
        parameters: {
          severity: 'errors',
        },
      },
      {
        type: 'code_scanning',
        parameters: {
          code_scanning_tools: [
            {
              tool: 'CodeQL',
              security_alerts_threshold: 'high_or_higher',
              alerts_threshold: 'errors',
            },
          ],
        },
      },
      {
        type: 'code_coverage',
        parameters: {
          minimum_coverage: null,
          max_coverage_drop: null,
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

function fixture() {
  const observed = baselineRuleset();
  const compiled = compileProofModeRulesetStage1({ ruleset: observed, repository: REPOSITORY });
  if (compiled.status !== 'ready' || !compiled.mutation) throw new Error('fixture must compile ready');
  return {
    observed,
    compiled,
    compliant: {
      id: observed.id,
      source_type: 'Repository',
      source: REPOSITORY,
      ...compiled.mutation.body,
    },
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

function trustedRepairSource() {
  return Promise.resolve({
    branch: 'main',
    sourceSha: TRUSTED_SOURCE_SHA,
    currentMainSha: TRUSTED_SOURCE_SHA,
    cleanCheckout: true,
  });
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

describe('ProofMode ruleset stage-1 executable admin repair', () => {
  it('pins the production carrier, fingerprints, and repair source policy in source', () => {
    const { compiled } = fixture();
    expect(compiled.observedFingerprint).toBe(PROOFMODE_RULESET_STAGE1.expectedObservedFingerprint);
    expect(compiled.desiredFingerprint).toBe(PROOFMODE_RULESET_STAGE1.expectedDesiredFingerprint);
    expect(PROOFMODE_RULESET_STAGE1).toEqual({
      repository: REPOSITORY,
      rulesetId: 20818149,
      expectedObservedFingerprint: '5758b4b5aba90895fc3639c4afff2459bc479a13293dc4a589a7829bc0345738',
      expectedDesiredFingerprint: '1a59d1f6f62ca848c0179dd7bc23fc7715327845146fce718e92da89b7a3707a',
      repairConfirmation: 'apply-proofmode-ruleset-stage1',
      repairSource: 'clean-current-main-only',
    });
  });

  it('check mode re-observes exact live state without mutating', async () => {
    const { observed, compiled } = fixture();
    const calls = [];
    const receipt = await applyProofModeRulesetStage1({
      env: envFor(),
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return response(observed);
      },
    });

    expect(receipt).toEqual(expect.objectContaining({
      status: 'ready',
      mutationAttempted: false,
      providerAccepted: false,
      mutated: false,
      outcomeVerified: false,
      observedFingerprint: compiled.observedFingerprint,
      desiredFingerprint: compiled.desiredFingerprint,
      verifiedFingerprint: null,
    }));
    expect(calls).toHaveLength(1);
    expect(calls[0].options.method).toBe('GET');
    expect(JSON.stringify(receipt)).not.toContain('admin-secret-token');
  });

  it('does not allow environment variables to redefine the pinned fingerprints', async () => {
    const { observed, compiled } = fixture();
    const receipt = await applyProofModeRulesetStage1({
      env: envFor({
        PROOFMODE_RULESET_EXPECTED_OBSERVED_FINGERPRINT: '0'.repeat(64),
        PROOFMODE_RULESET_EXPECTED_DESIRED_FINGERPRINT: '1'.repeat(64),
      }),
      fetchImpl: async () => response(observed),
    });
    expect(receipt.observedFingerprint).toBe(compiled.observedFingerprint);
    expect(receipt.desiredFingerprint).toBe(compiled.desiredFingerprint);
    expect(receipt.status).toBe('ready');
  });

  it('repair performs source proof, a second preflight, one PUT, and verified readback', async () => {
    const { observed, compiled, compliant } = fixture();
    const calls = [];
    const queue = [
      response(observed),
      response(observed),
      response(compliant),
      response(compliant),
    ];
    const receipt = await applyProofModeRulesetStage1({
      env: envFor({
        PROOFMODE_RULESET_MODE: 'repair',
        PROOFMODE_RULESET_REPAIR_CONFIRMATION: 'apply-proofmode-ruleset-stage1',
      }),
      repairSourceVerifier: trustedRepairSource,
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        const next = queue.shift();
        if (!next) throw new Error('unexpected extra GitHub call');
        return next;
      },
    });

    expect(calls.map((call) => call.options.method)).toEqual(['GET', 'GET', 'PUT', 'GET']);
    expect(calls[2].url).toBe('https://api.github.com/repos/jussray/chief-ai-machine/rulesets/20818149');
    expect(JSON.parse(calls[2].options.body)).toEqual(compiled.mutation.body);
    expect(receipt).toEqual(expect.objectContaining({
      status: 'verified-applied',
      mutationAttempted: true,
      providerAccepted: true,
      mutated: true,
      outcomeVerified: true,
      preMutationFingerprint: compiled.observedFingerprint,
      verifiedFingerprint: compiled.desiredFingerprint,
      sourceSha: TRUSTED_SOURCE_SHA,
    }));
  });

  it('fails closed when live state drifts between initial observation and pre-mutation re-observation', async () => {
    const { observed } = fixture();
    const drifted = JSON.parse(JSON.stringify(observed));
    drifted.rules.push({ type: 'creation' });
    const methods = [];
    const queue = [response(observed), response(drifted)];

    await expect(applyProofModeRulesetStage1({
      env: envFor({
        PROOFMODE_RULESET_MODE: 'repair',
        PROOFMODE_RULESET_REPAIR_CONFIRMATION: 'apply-proofmode-ruleset-stage1',
      }),
      repairSourceVerifier: trustedRepairSource,
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return queue.shift();
      },
    })).rejects.toThrow(/pre-mutation-reobservation: live ruleset drifted/);

    expect(methods).toEqual(['GET', 'GET']);
  });

  it('refuses repair without the exact explicit confirmation before source or mutation access', async () => {
    const { observed } = fixture();
    const methods = [];
    await expect(applyProofModeRulesetStage1({
      env: envFor({ PROOFMODE_RULESET_MODE: 'repair' }),
      repairSourceVerifier: async () => {
        throw new Error('source verifier should not run');
      },
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return response(observed);
      },
    })).rejects.toThrow(/PROOFMODE_RULESET_REPAIR_CONFIRMATION/);
    expect(methods).toEqual(['GET']);
  });

  it('accepts an already-applied desired state without source proof or PUT', async () => {
    const { compiled, compliant } = fixture();
    const methods = [];
    const receipt = await applyProofModeRulesetStage1({
      env: envFor({ PROOFMODE_RULESET_MODE: 'repair' }),
      repairSourceVerifier: async () => {
        throw new Error('source verifier should not run');
      },
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return response(compliant);
      },
    });
    expect(receipt).toEqual(expect.objectContaining({
      status: 'already-applied',
      mutationAttempted: false,
      providerAccepted: false,
      mutated: false,
      outcomeVerified: true,
      verifiedFingerprint: compiled.desiredFingerprint,
    }));
    expect(methods).toEqual(['GET']);
  });

  it('requires a clean checkout whose local HEAD equals current main before repair', async () => {
    const fetchCalls = [];
    const fetchImpl = async (url, options) => {
      fetchCalls.push({ url, options });
      return response({ commit: { sha: TRUSTED_SOURCE_SHA } });
    };

    await expect(verifyTrustedRulesetRepairSource({
      fetchImpl,
      token: 'admin-secret-token',
      gitProbe: async () => ({
        head: TRUSTED_SOURCE_SHA,
        cleanCheckout: false,
      }),
    })).rejects.toThrow(/checkout must be clean/);
    expect(fetchCalls).toHaveLength(0);

    await expect(verifyTrustedRulesetRepairSource({
      fetchImpl,
      token: 'admin-secret-token',
      gitProbe: async () => ({
        head: 'b'.repeat(40),
        cleanCheckout: true,
      }),
    })).rejects.toThrow(/not current protected main/);
    expect(fetchCalls).toHaveLength(1);

    const trusted = await verifyTrustedRulesetRepairSource({
      fetchImpl,
      token: 'admin-secret-token',
      gitProbe: async () => ({
        head: TRUSTED_SOURCE_SHA,
        cleanCheckout: true,
      }),
    });
    expect(trusted).toEqual({
      branch: 'main',
      sourceSha: TRUSTED_SOURCE_SHA,
      currentMainSha: TRUSTED_SOURCE_SHA,
      cleanCheckout: true,
    });
  });

  it('records outcome unknown instead of false non-mutation when PUT transport fails', async () => {
    const { observed } = fixture();
    const methods = [];
    let thrown;
    try {
      await applyProofModeRulesetStage1({
        env: envFor({
          PROOFMODE_RULESET_MODE: 'repair',
          PROOFMODE_RULESET_REPAIR_CONFIRMATION: 'apply-proofmode-ruleset-stage1',
        }),
        repairSourceVerifier: trustedRepairSource,
        fetchImpl: async (_url, options) => {
          methods.push(options.method);
          if (methods.length <= 2) return response(observed);
          throw new Error('connection lost after write started');
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(methods).toEqual(['GET', 'GET', 'PUT']);
    const failure = buildProofModeRulesetStage1FailureReceipt({
      env: envFor({ PROOFMODE_RULESET_MODE: 'repair' }),
      error: thrown,
    });
    expect(failure).toEqual(expect.objectContaining({
      status: 'outcome-unknown',
      mutationAttempted: true,
      providerAccepted: false,
      mutated: null,
      outcomeVerified: false,
      sourceSha: TRUSTED_SOURCE_SHA,
    }));
  });

  it('records provider acceptance without claiming verified outcome when post-write verification fails', async () => {
    const { observed, compliant } = fixture();
    const methods = [];
    let thrown;
    try {
      await applyProofModeRulesetStage1({
        env: envFor({
          PROOFMODE_RULESET_MODE: 'repair',
          PROOFMODE_RULESET_REPAIR_CONFIRMATION: 'apply-proofmode-ruleset-stage1',
        }),
        repairSourceVerifier: trustedRepairSource,
        fetchImpl: async (_url, options) => {
          methods.push(options.method);
          if (methods.length <= 2) return response(observed);
          if (methods.length === 3) return response(compliant);
          throw new Error('readback unavailable');
        },
      });
    } catch (error) {
      thrown = error;
    }

    expect(methods).toEqual(['GET', 'GET', 'PUT', 'GET']);
    const failure = buildProofModeRulesetStage1FailureReceipt({
      env: envFor({ PROOFMODE_RULESET_MODE: 'repair' }),
      error: thrown,
    });
    expect(failure).toEqual(expect.objectContaining({
      status: 'accepted-unverified',
      mutationAttempted: true,
      providerAccepted: true,
      mutated: true,
      outcomeVerified: false,
      sourceSha: TRUSTED_SOURCE_SHA,
    }));
  });

  it('refuses to retarget the admin primitive to another repository', async () => {
    await expect(applyProofModeRulesetStage1({
      env: envFor({ GITHUB_REPOSITORY: 'someone/else' }),
      fetchImpl: async () => response({}),
    })).rejects.toThrow(/pinned to jussray\/chief-ai-machine/);
  });
});
