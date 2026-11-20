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
  it('materializes the required candidate check from a trusted evaluator independently of applicability', () => {
    expect(workflow).toContain('pull_request_target:');
    expect(workflow).toContain('Classify ProofMode applicability');
    expect(workflow).toContain("if: steps.scope.outputs.changed == 'true'");
    const publisher = workflow.split('  publish-candidate-required-check:')[1];
    expect(publisher).toContain("if: always() && github.event_name == 'pull_request_target'");
    expect(publisher).toContain('SOURCE_RESULT: ${{ needs.verify.result }}');
    expect(publisher).toContain("process.env.SOURCE_RESULT === 'success' ? 'success' : 'failure'");
    expect(publisher).toContain('head_sha: process.env.EXPECTED_HEAD_SHA');
  });

  it('rechecks changed ProofMode production or candidate proof workflows', () => {
    expect(workflow).toContain('proofmode-mcp-playwright');
    expect(workflow).toContain('proofmode-production-playwright');
    expect(workflow).toContain("echo 'changed=true' >> \"$GITHUB_OUTPUT\"");
    expect(workflow).toContain("echo 'changed=false' >> \"$GITHUB_OUTPUT\"");
    expect(workflow).toContain('N/A proven from trusted exact-head semantic diff');
  });

  it('binds scope to the PR head and a checked-out trusted base', () => {
    expect(workflow).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || inputs.expected_head_sha }}');
    expect(workflow).toContain('BASE_SHA: ${{ github.sha }}');
    expect(workflow).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
    expect(workflow).toContain('test "$TRUSTED_EVALUATOR_SHA" = "$BASE_SHA"');
    expect(workflow).toContain('git diff --no-renames --name-only "$BASE_SHA"..."$EXPECTED_HEAD_SHA"');
    expect(workflow).toContain('ref: ${{ env.TRUSTED_EVALUATOR_SHA }}');
    expect(workflow).toContain('fetch-depth: 0');
  });

  it('keeps Cloudflare Access credentials out of pull-request-authored proof jobs', () => {
    const privilegedOnlyId = "CLOUDFLARE_ACCESS_CLIENT_ID: ${{ github.event_name == 'workflow_dispatch' && secrets.CLOUDFLARE_ACCESS_CLIENT_ID || '' }}";
    const privilegedOnlySecret = "CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ github.event_name == 'workflow_dispatch' && secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET || '' }}";
    const unsafeId = 'CLOUDFLARE_ACCESS_CLIENT_ID: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}';
    const unsafeSecret = 'CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}';

    for (const candidate of [workflow, capabilityWorkflow, governanceWorkflow]) {
      expect(candidate).toContain(privilegedOnlyId);
      expect(candidate).toContain(privilegedOnlySecret);
      expect(candidate).not.toContain(unsafeId);
      expect(candidate).not.toContain(unsafeSecret);
    }
  });

  it('classifies Access interception without telling PR runs to configure secrets', () => {
    for (const candidate of [workflow, capabilityWorkflow]) {
      expect(candidate).toContain('privileged service auth is intentionally unavailable on pull_request');
      expect(candidate).toContain('Cloudflare Access rejected the configured service token');
      expect(candidate).not.toContain('configure the service-token secret pair for this repository/environment');
    }
    expect(governanceWorkflow).toContain('privileged service auth is intentionally unavailable on pull_request');
    expect(governanceWorkflow).toContain('configured service token was not accepted by the effective Access policy');
  });

  it('keeps production ProofMode verification post-merge only', () => {
    expect(productionWorkflow).toContain('push:\n    branches:\n      - main');
    expect(productionWorkflow).toContain('workflow_dispatch:');
    expect(productionWorkflow).not.toContain('pull_request:');
    expect(productionWorkflow).not.toContain('Materialize pull-request production receipt');
    expect(productionWorkflow).toContain('Run production ProofMode MCP Playwright proof');
  });
});
