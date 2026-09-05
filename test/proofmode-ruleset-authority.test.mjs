import { describe, expect, it } from 'vitest';
import {
  requiredStatusChecks,
  requiredStatusContexts,
  rulesetTargetsDefaultBranch,
  validateProofModeRulesetMigration,
} from '../scripts/verify-proofmode-ruleset.mjs';

const TRUSTED_GITHUB_ACTIONS_INTEGRATION_ID = 15368;
const TRUSTED_RULESET_ID = 20818149;
const TRUSTED_RULESET_NAME = 'Chief AI main exact-head gate';

const semantics = {
  legacyPreMergeProofModeContexts: [
    'Verify live ProofMode MCP with Playwright',
    'Verify production ProofMode MCP with Playwright',
  ],
  preMergeCandidateContext: 'Verify candidate ProofMode runtime with Playwright',
  preMergeCandidateIntegrationId: TRUSTED_GITHUB_ACTIONS_INTEGRATION_ID,
  preMergeCandidateRulesetId: TRUSTED_RULESET_ID,
  preMergeCandidateRulesetName: TRUSTED_RULESET_NAME,
  preMergeCandidateRulesetMustHaveNoBypassActors: true,
};

function ruleset({
  id = TRUSTED_RULESET_ID,
  name = TRUSTED_RULESET_NAME,
  enforcement = 'active',
  include = ['~DEFAULT_BRANCH'],
  exclude = [],
  contexts = [],
  bypassActors = [],
} = {}) {
  return {
    id,
    name,
    target: 'branch',
    enforcement,
    conditions: { ref_name: { include, exclude } },
    bypass_actors: bypassActors,
    rules: [{
      type: 'required_status_checks',
      parameters: {
        required_status_checks: contexts.map((entry) => {
          if (typeof entry === 'string') {
            return {
              context: entry,
              integration_id: TRUSTED_GITHUB_ACTIONS_INTEGRATION_ID,
            };
          }
          return { ...entry };
        }),
      },
    }],
  };
}

describe('ProofMode live ruleset authority', () => {
  it('extracts unique required status contexts while preserving producer identity separately', () => {
    const observed = ruleset({
      contexts: [
        'Typecheck',
        'Typecheck',
        'Verify operational authority',
      ],
    });

    expect(requiredStatusContexts(observed)).toEqual(['Typecheck', 'Verify operational authority']);
    expect(requiredStatusChecks(observed)).toEqual([
      { context: 'Typecheck', integrationId: TRUSTED_GITHUB_ACTIONS_INTEGRATION_ID },
      { context: 'Verify operational authority', integrationId: TRUSTED_GITHUB_ACTIONS_INTEGRATION_ID },
    ]);
  });

  it('recognizes only active rulesets that actually target the default branch', () => {
    expect(rulesetTargetsDefaultBranch(ruleset(), 'main')).toBe(true);
    expect(rulesetTargetsDefaultBranch(ruleset({ include: ['refs/heads/main'] }), 'main')).toBe(true);
    expect(rulesetTargetsDefaultBranch(ruleset({ enforcement: 'evaluate' }), 'main')).toBe(false);
    expect(rulesetTargetsDefaultBranch(ruleset({ include: ['refs/heads/dev'] }), 'main')).toBe(false);
    expect(rulesetTargetsDefaultBranch(ruleset({ exclude: ['~DEFAULT_BRANCH'] }), 'main')).toBe(false);
  });

  it('fails when either legacy pre-merge ProofMode context remains or candidate proof is missing', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [ruleset({
        id: 21261587,
        name: 'governance boundary',
        contexts: [
          'Typecheck',
          'Verify live ProofMode MCP with Playwright',
          'Verify production ProofMode MCP with Playwright',
        ],
      })],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'legacy-proofmode-context-still-required',
        context: 'Verify live ProofMode MCP with Playwright',
      }),
      expect.objectContaining({
        classification: 'legacy-proofmode-context-still-required',
        context: 'Verify production ProofMode MCP with Playwright',
      }),
      expect.objectContaining({
        classification: 'candidate-proofmode-context-not-required',
        context: 'Verify candidate ProofMode runtime with Playwright',
      }),
      expect.objectContaining({
        classification: 'candidate-proofmode-authoritative-ruleset-not-required',
        expectedRulesetId: TRUSTED_RULESET_ID,
      }),
    ]));
  });

  it('passes only when candidate proof is required by the trusted no-bypass ruleset and trusted integration', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [
        ruleset({
          id: 21261587,
          name: 'governance boundary',
          contexts: ['Verify operational authority'],
          bypassActors: [{ actor_type: 'RepositoryRole', actor_id: 5 }],
        }),
        ruleset({
          contexts: ['Verify candidate ProofMode runtime with Playwright'],
        }),
      ],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.candidateIntegrationId).toBe(TRUSTED_GITHUB_ACTIONS_INTEGRATION_ID);
    expect(result.candidateRulesetId).toBe(TRUSTED_RULESET_ID);
    expect(result.candidateRulesets).toEqual([{ id: TRUSTED_RULESET_ID, name: TRUSTED_RULESET_NAME }]);
  });

  it('fails closed when the candidate check name is present but unbound to an integration', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [ruleset({
        contexts: [{ context: 'Verify candidate ProofMode runtime with Playwright' }],
      })],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-proofmode-integration-mismatch',
        expectedIntegrationId: TRUSTED_GITHUB_ACTIONS_INTEGRATION_ID,
      }),
    ]));
  });

  it('fails closed when the candidate check name is supplied by the wrong integration', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [ruleset({
        contexts: [{
          context: 'Verify candidate ProofMode runtime with Playwright',
          integration_id: 99999,
        }],
      })],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-proofmode-integration-mismatch',
        expectedIntegrationId: TRUSTED_GITHUB_ACTIONS_INTEGRATION_ID,
        observed: expect.arrayContaining([
          expect.objectContaining({ integrationId: 99999 }),
        ]),
      }),
    ]));
  });

  it('fails closed when the candidate proof is placed in a different active ruleset', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [ruleset({
        id: 21261587,
        name: 'governance boundary',
        contexts: ['Verify candidate ProofMode runtime with Playwright'],
        bypassActors: [],
      })],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-proofmode-ruleset-mismatch',
        expectedRulesetId: TRUSTED_RULESET_ID,
      }),
      expect.objectContaining({
        classification: 'candidate-proofmode-authoritative-ruleset-not-required',
        expectedRulesetId: TRUSTED_RULESET_ID,
      }),
    ]));
  });

  it('fails closed when the authoritative candidate ruleset has any bypass actor', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [ruleset({
        contexts: ['Verify candidate ProofMode runtime with Playwright'],
        bypassActors: [{ actor_type: 'RepositoryRole', actor_id: 5 }],
      })],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'candidate-proofmode-ruleset-bypassable',
        expectedRulesetId: TRUSTED_RULESET_ID,
      }),
    ]));
  });

  it('fails closed if producer or no-bypass carrier identity is missing from the governance contract', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [ruleset({
        contexts: ['Verify candidate ProofMode runtime with Playwright'],
      })],
      semantics: {
        ...semantics,
        preMergeCandidateIntegrationId: undefined,
        preMergeCandidateRulesetId: undefined,
        preMergeCandidateRulesetMustHaveNoBypassActors: false,
      },
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: 'proofmode-ruleset-contract-incomplete' }),
    ]));
  });

  it('does not let an inactive or non-main legacy ruleset poison current main authority', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [
        ruleset({
          id: 1,
          enforcement: 'disabled',
          contexts: ['Verify live ProofMode MCP with Playwright'],
        }),
        ruleset({
          id: 2,
          include: ['refs/heads/dev'],
          contexts: ['Verify production ProofMode MCP with Playwright'],
        }),
        ruleset({
          contexts: ['Verify candidate ProofMode runtime with Playwright'],
        }),
      ],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(true);
  });

  it('fails closed when no active default-branch ruleset can be observed', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [],
      semantics,
      defaultBranch: 'main',
    });
    expect(result.ok).toBe(false);
    expect(result.violations).toEqual(expect.arrayContaining([
      expect.objectContaining({ classification: 'default-branch-ruleset-not-observed' }),
      expect.objectContaining({ classification: 'candidate-proofmode-context-not-required' }),
      expect.objectContaining({ classification: 'candidate-proofmode-authoritative-ruleset-not-required' }),
    ]));
  });
});
