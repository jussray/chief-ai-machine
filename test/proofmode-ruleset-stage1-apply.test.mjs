import { describe, expect, it } from 'vitest';
import { compileProofModeRulesetStage1 } from '../scripts/compile-proofmode-ruleset-stage1.mjs';
import {
  applyProofModeRulesetStage1,
  PROOFMODE_RULESET_STAGE1,
} from '../scripts/apply-proofmode-ruleset-stage1.mjs';

const REPOSITORY = 'jussray/chief-ai-machine';

function baselineRuleset() {
  return {
    id: 20818149,
    name: 'Chief AI main exact-head gate',
    target: 'branch',
    enforcement: 'active',
    bypass_actors: [],
    conditions: {
      ref_name: {
        exclude: [],
        include: ['~DEFAULT_BRANCH'],
      },
    },
    rules: [
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
      ...compiled.mutation.body,
    },
  };
}

function envFor(compiled, overrides = {}) {
  return {
    GITHUB_REPOSITORY: REPOSITORY,
    GITHUB_RULESET_ADMIN_TOKEN: 'admin-secret-token',
    PROOFMODE_RULESET_MODE: 'check',
    PROOFMODE_RULESET_EXPECTED_OBSERVED_FINGERPRINT: compiled.observedFingerprint,
    PROOFMODE_RULESET_EXPECTED_DESIRED_FINGERPRINT: compiled.desiredFingerprint,
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

describe('ProofMode ruleset stage-1 executable admin repair', () => {
  it('pins the production carrier and prepared stage-1 fingerprints', () => {
    expect(PROOFMODE_RULESET_STAGE1).toEqual({
      repository: REPOSITORY,
      rulesetId: 20818149,
      expectedObservedFingerprint: '5758b4b5aba90895fc3639c4afff2459bc479a13293dc4a589a7829bc0345738',
      expectedDesiredFingerprint: 'f337fd4a3a0c2eab9e913c76381046dbf8e581b8ec76e90f06a221142b668dd7',
      repairConfirmation: 'apply-proofmode-ruleset-stage1',
    });
  });

  it('check mode re-observes exact live state without mutating', async () => {
    const { observed, compiled } = fixture();
    const calls = [];
    const receipt = await applyProofModeRulesetStage1({
      env: envFor(compiled),
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return response(observed);
      },
    });

    expect(receipt).toEqual(expect.objectContaining({
      status: 'ready',
      mutated: false,
      observedFingerprint: compiled.observedFingerprint,
      desiredFingerprint: compiled.desiredFingerprint,
      verifiedFingerprint: null,
    }));
    expect(calls).toHaveLength(1);
    expect(calls[0].options.method).toBe('GET');
    expect(JSON.stringify(receipt)).not.toContain('admin-secret-token');
  });

  it('repair mode performs exactly one PUT and requires verified readback', async () => {
    const { observed, compiled, compliant } = fixture();
    const calls = [];
    const queue = [response(observed), response(compliant), response(compliant)];
    const receipt = await applyProofModeRulesetStage1({
      env: envFor(compiled, {
        PROOFMODE_RULESET_MODE: 'repair',
        PROOFMODE_RULESET_REPAIR_CONFIRMATION: 'apply-proofmode-ruleset-stage1',
      }),
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        const next = queue.shift();
        if (!next) throw new Error('unexpected extra GitHub call');
        return next;
      },
    });

    expect(calls.map((call) => call.options.method)).toEqual(['GET', 'PUT', 'GET']);
    expect(calls[1].url).toBe('https://api.github.com/repos/jussray/chief-ai-machine/rulesets/20818149');
    expect(JSON.parse(calls[1].options.body)).toEqual(compiled.mutation.body);
    expect(receipt).toEqual(expect.objectContaining({
      status: 'verified-applied',
      mutated: true,
      verifiedFingerprint: compiled.desiredFingerprint,
    }));
  });

  it('fails closed on live fingerprint drift before any PUT', async () => {
    const { observed, compiled } = fixture();
    const methods = [];
    await expect(applyProofModeRulesetStage1({
      env: envFor(compiled, {
        PROOFMODE_RULESET_MODE: 'repair',
        PROOFMODE_RULESET_REPAIR_CONFIRMATION: 'apply-proofmode-ruleset-stage1',
        PROOFMODE_RULESET_EXPECTED_OBSERVED_FINGERPRINT: '0'.repeat(64),
      }),
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return response(observed);
      },
    })).rejects.toThrow(/drifted before stage 1/);
    expect(methods).toEqual(['GET']);
  });

  it('refuses repair without the exact explicit confirmation', async () => {
    const { observed, compiled } = fixture();
    const methods = [];
    await expect(applyProofModeRulesetStage1({
      env: envFor(compiled, { PROOFMODE_RULESET_MODE: 'repair' }),
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return response(observed);
      },
    })).rejects.toThrow(/PROOFMODE_RULESET_REPAIR_CONFIRMATION/);
    expect(methods).toEqual(['GET']);
  });

  it('accepts an already-applied desired state without issuing PUT', async () => {
    const { compiled, compliant } = fixture();
    const methods = [];
    const receipt = await applyProofModeRulesetStage1({
      env: envFor(compiled, { PROOFMODE_RULESET_MODE: 'repair' }),
      fetchImpl: async (_url, options) => {
        methods.push(options.method);
        return response(compliant);
      },
    });
    expect(receipt).toEqual(expect.objectContaining({
      status: 'already-applied',
      mutated: false,
      verifiedFingerprint: compiled.desiredFingerprint,
    }));
    expect(methods).toEqual(['GET']);
  });

  it('refuses to retarget the admin primitive to another repository', async () => {
    const { compiled } = fixture();
    await expect(applyProofModeRulesetStage1({
      env: envFor(compiled, { GITHUB_REPOSITORY: 'someone/else' }),
      fetchImpl: async () => response({}),
    })).rejects.toThrow(/pinned to jussray\/chief-ai-machine/);
  });
});
