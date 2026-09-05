import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const GITHUB_ACTIONS_INTEGRATION_ID = 15368;

function loadSemantics() {
  const config = JSON.parse(fs.readFileSync(new URL('../config/operational-authority.json', import.meta.url), 'utf8'));
  return config.proofContextSemantics || {};
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
});
