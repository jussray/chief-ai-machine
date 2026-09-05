import { describe, expect, it } from 'vitest';
import {
  requiredStatusContexts,
  rulesetTargetsDefaultBranch,
  validateProofModeRulesetMigration,
} from '../scripts/verify-proofmode-ruleset.mjs';

const semantics = {
  legacyPreMergeProofModeContexts: [
    'Verify live ProofMode MCP with Playwright',
    'Verify production ProofMode MCP with Playwright',
  ],
  preMergeCandidateContext: 'Verify candidate ProofMode runtime with Playwright',
};

function ruleset({
  id = 1,
  name = 'governance boundary',
  enforcement = 'active',
  include = ['~DEFAULT_BRANCH'],
  exclude = [],
  contexts = [],
} = {}) {
  return {
    id,
    name,
    target: 'branch',
    enforcement,
    conditions: { ref_name: { include, exclude } },
    rules: [{
      type: 'required_status_checks',
      parameters: {
        required_status_checks: contexts.map((context) => ({ context })),
      },
    }],
  };
}

describe('ProofMode live ruleset authority', () => {
  it('extracts unique required status contexts', () => {
    expect(requiredStatusContexts(ruleset({
      contexts: ['Typecheck', 'Typecheck', 'Verify operational authority'],
    }))).toEqual(['Typecheck', 'Verify operational authority']);
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
    ]));
  });

  it('passes only when candidate proof is required and both legacy pre-merge contexts are absent', () => {
    const result = validateProofModeRulesetMigration({
      rulesets: [
        ruleset({ id: 1, contexts: ['Typecheck', 'Verify operational authority'] }),
        ruleset({
          id: 2,
          contexts: ['Verify candidate ProofMode runtime with Playwright'],
        }),
      ],
      semantics,
      defaultBranch: 'main',
    });

    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.candidateRulesets).toEqual([{ id: 2, name: 'governance boundary' }]);
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
          id: 3,
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
    ]));
  });
});
