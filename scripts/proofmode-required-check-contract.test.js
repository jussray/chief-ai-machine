import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/proofmode-mcp-playwright.yml'),
  'utf8',
);

const capabilityWorkflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/chief-capability-plan-playwright.yml'),
  'utf8',
);

const governanceWorkflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/governance-boundary-required-receipts.yml'),
  'utf8',
);

const productionWorkflow = readFileSync(
  resolve(process.cwd(), '.github/workflows/proofmode-production-playwright.yml'),
  'utf8',
);

describe('ProofMode required-check contract', () => {
  it('keeps required-check materialization separate from proof applicability', () => {
    for (const candidate of [workflow, capabilityWorkflow]) {
      expect(candidate).toContain('pull_request_target:');
      expect(candidate).toContain('TRUSTED_EVALUATOR_SHA');
      expect(candidate).toContain("if: steps.scope.outputs.changed == 'true'");
      expect(candidate).toContain('publish-candidate-required-check');
    }
    expect(governanceWorkflow).toContain('pull_request:\n    branches:\n      - main');
  });

  it('scopes applicability to exact-head diff from trusted evaluator', () => {
    expect(workflow).toContain('Classify ProofMode applicability');
    expect(capabilityWorkflow).toContain('Classify capability-plan applicability');
    for (const candidate of [workflow, capabilityWorkflow]) {
      expect(candidate).toContain('git diff --no-renames --name-only');
      expect(candidate).toContain('fetch-depth: 0');
    }
  });

  it('keeps Cloudflare Access credentials out of pull-request-authored proof jobs', () => {
    for (const candidate of [workflow, capabilityWorkflow]) {
      expect(candidate).toContain('Long-lived Access credentials are intentionally withheld from candidate runtime');
    }

    const privilegedOnlyId = "CLOUDFLARE_ACCESS_CLIENT_ID: ${{ github.event_name == 'workflow_dispatch' && secrets.CLOUDFLARE_ACCESS_CLIENT_ID || '' }}";
    const privilegedOnlySecret = "CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ github.event_name == 'workflow_dispatch' && secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET || '' }}";
    expect(governanceWorkflow).toContain(privilegedOnlyId);
    expect(governanceWorkflow).toContain(privilegedOnlySecret);
  });

  it('classifies Access interception without telling PR runs to configure secrets', () => {
    for (const candidate of [workflow, capabilityWorkflow]) {
      expect(candidate).toContain('Cloudflare Access blocks candidate proof');
      expect(candidate).not.toContain('configure the service-token secret pair for this repository/environment');
    }
    expect(governanceWorkflow).toContain('privileged service auth is intentionally unavailable on pull_request');
    expect(governanceWorkflow).toContain('configured service token was not accepted by the effective Access policy');
  });

  it('keeps production ProofMode verification dispatch-only (hand-started after merge)', () => {
    expect(productionWorkflow).toMatch(/^on:\s+workflow_dispatch:/m);
    expect(productionWorkflow).not.toContain('on:\n  push:');
    expect(productionWorkflow).not.toContain('pull_request:');
    expect(productionWorkflow).toContain('workflow_dispatch:');
    expect(productionWorkflow).toContain('expected_sha:');
    expect(productionWorkflow).toContain('authority_pr:');
    expect(productionWorkflow).not.toContain('Materialize pull-request production receipt');
  });
});
