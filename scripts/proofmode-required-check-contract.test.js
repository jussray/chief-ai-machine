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
    expect(workflow).toContain('pull_request:\n    branches:\n      - main');
    expect(workflow).toContain('Determine ProofMode applicability');
    expect(workflow).toContain("if: steps.scope.outputs.applicable == 'true'");
  });

  it('invalidates live proof when either ProofMode proof workflow changes', () => {
    expect(workflow).toContain(
      '.github/workflows/proofmode-mcp-playwright.yml|.github/workflows/proofmode-production-playwright.yml)',
    );
    expect(workflow).toContain('reason=proofmode-proof-workflow-changed');
  });

  it('binds applicability to the exact pull-request base and head', () => {
    expect(workflow).toContain("PR_BASE_SHA: ${{ github.event.pull_request.base.sha || '' }}");
    expect(workflow).toContain('git diff --name-only "$PR_BASE_SHA" "$EXPECTED_HEAD_SHA"');
    expect(workflow).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
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
