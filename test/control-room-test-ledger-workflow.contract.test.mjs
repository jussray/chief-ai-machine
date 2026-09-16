import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflow = await readFile('.github/workflows/control-room-test-ledger.yml', 'utf8');
const quality = await readFile('.github/workflows/quality-gate.yml', 'utf8');
const materializer = await readFile('.github/workflows/governance-required-check-materializer.yml', 'utf8');
const founderGoals = await readFile('.github/workflows/founder-goals-playwright.yml', 'utf8');
const freestyle = await readFile('.github/workflows/freestyle-save-playwright.yml', 'utf8');
const capability = await readFile('.github/workflows/chief-capability-plan-playwright.yml', 'utf8');
const proofmode = await readFile('.github/workflows/proofmode-mcp-playwright.yml', 'utf8');
const productionProof = await readFile('.github/workflows/proofmode-production-playwright.yml', 'utf8');
const manifest = JSON.parse(await readFile('.control-room/test-ledger.manifest.json', 'utf8'));

describe('Control Room Test Ledger workflow contract', () => {
  it('materializes the ruleset-required ledger check and fails closed on prerequisite failure', () => {
    const publishSection = workflow.split('  publish-ledger:')[1];
    expect(workflow).toContain('pull_request:');
    expect(publishSection).toContain('name: Publish exact-head test ledger');
    expect(publishSection).toContain('if: ${{ always() }}');
    expect(publishSection).toContain('LEDGER_CONTRACT_RESULT: ${{ needs.ledger-contract.result }}');
    expect(publishSection).toContain('test "$LEDGER_CONTRACT_RESULT" = \'success\'');
  });

  it('materializes the required SonarQube context instead of leaving a no-steps skipped job', () => {
    const sonarSection = quality.split('  sonarqube:')[1];
    expect(sonarSection).toContain('name: "SonarQube – Founder Intelligence"');
    expect(sonarSection).toContain('if: ${{ always() }}');
    expect(sonarSection).toContain('UNIT_TEST_RESULT: ${{ needs.unit-tests.result }}');
    expect(sonarSection).toContain('test "$UNIT_TEST_RESULT" = \'success\'');
  });

  it('keeps the observer outside the authority set to avoid self-authorization', () => {
    expect(manifest.source.excludeObserverCheck).toBe(true);
    expect(manifest.policy.requiredChecks).not.toContain('Publish exact-head test ledger');
    expect(manifest.controlRoom.authority).toBe('read-only-test-evidence');
  });

  it('runs governance-required evaluation only from an event-bound trusted base snapshot', () => {
    expect(materializer).toContain('pull_request_target:');
    expect(materializer).not.toMatch(/\n {2}pull_request:\n/);
    expect(materializer).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
    expect(materializer).toContain('test "$TRUSTED_EVALUATOR_SHA" = "$BASE_SHA"');
    expect(materializer).toContain('ref: ${{ env.TRUSTED_EVALUATOR_SHA }}');
    expect(materializer).toContain('test "$HEAD_REPO" = "$GITHUB_REPOSITORY"');
  });

  it('provides a trusted real exact-runtime Playwright path without executing candidate package metadata', () => {
    const runtimeSection = materializer.split('  runtime-proof:')[1].split('  founder-goals-applicability:')[0];
    expect(runtimeSection).toContain('name: Verify exact Chief runtime with Playwright');
    expect(runtimeSection).toContain('Resolve authenticated exact-head Cloudflare preview');
    expect(runtimeSection).toContain('Install isolated trusted Playwright runner');
    expect(runtimeSection).toContain('Run trusted exact-runtime browser proof');
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/version`');
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/`');
    expect(runtimeSection).toContain("getByRole('heading', { name: 'What are we trying to accomplish?' })");
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/styles/main.css`');
    expect(runtimeSection).not.toContain('npm ci');
  });

  it('treats deployed SPA assets and both sides of renames as runtime changes', () => {
    const runtimeSection = materializer.split('  runtime-proof:')[1].split('  founder-goals-applicability:')[0];
    expect(runtimeSection).toContain('index\\.html$');
    expect(runtimeSection).toContain('styles/');
    expect(runtimeSection).toContain('src/');
    expect(runtimeSection).toContain('\\.assetsignore$');
    expect(runtimeSection).toContain('git diff --no-renames --name-only');
  });

  it('authenticates Cloudflare check-run provenance and includes the base in inheritance search', () => {
    const providerSection = materializer.split('  provider-receipt:')[1].split('  runtime-proof:')[0];
    expect(materializer).toContain("CLOUDFLARE_CHECK_APP_ID: '85455'");
    expect(providerSection).toContain('x.app?.id === Number(process.env.CLOUDFLARE_CHECK_APP_ID)');
    expect(providerSection).toContain("printf '%s\\n' \"$BASE_SHA\"");
    expect(providerSection).toContain('git diff --no-renames --name-only "$inherited_sha" "$EXPECTED_HEAD_SHA"');
    expect(providerSection).toContain("grep -Ev '^(\\.github/|test/|vitest\\.config\\.js$)'");
  });

  it('keeps Access secrets scoped to trusted runtime steps and does not retain authenticated traces', () => {
    const preamble = materializer.split('concurrency:')[0];
    const runtimeSection = materializer.split('  runtime-proof:')[1].split('  founder-goals-applicability:')[0];
    expect(preamble).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(runtimeSection).toContain("trace: hasAccess ? 'off' : 'retain-on-failure'");
    expect(runtimeSection).toContain("steps.access-auth.outputs.enabled != 'true'");
    expect(runtimeSection).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
  });

  it('gives feature required contexts one trusted producer each instead of duplicate materializer failures', () => {
    expect(materializer).not.toContain('name: Verify Founder Goals desktop and mobile flow');
    expect(materializer).not.toContain('name: Verify Freestyle, Goalfix, and PromptOS in Chromium');
    expect(materializer).not.toContain('name: Verify live Chief capability plan with Playwright');
    expect(materializer).not.toContain('name: Verify live ProofMode MCP with Playwright');
    expect(founderGoals).toContain('name: Verify Founder Goals desktop and mobile flow');
    expect(freestyle).toContain('name: Verify Freestyle, Goalfix, and PromptOS in Chromium');
    expect(capability).toContain('name: Verify live Chief capability plan with Playwright');
    expect(proofmode).toContain('name: Verify live ProofMode MCP with Playwright');
  });

  it('runs all feature proof producers from trusted pull_request_target snapshots with internal applicability checks', () => {
    for (const trustedWorkflow of [founderGoals, freestyle, capability, proofmode]) {
      expect(trustedWorkflow).toContain('pull_request_target:');
      expect(trustedWorkflow).not.toMatch(/\n {2}pull_request:\n/);
      expect(trustedWorkflow).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
      expect(trustedWorkflow).toContain('git diff --no-renames --name-only');
      expect(trustedWorkflow).toContain('ref: ${{ env.TRUSTED_EVALUATOR_SHA }}');
    }
  });

  it('covers the complete capability-plan dependency surface', () => {
    for (const path of ['capability-plan', 'capability-registry', 'connection-requests', 'goal-plan', 'outcome-feedback']) {
      expect(capability).toContain(path);
    }
  });

  it('keeps secret-bearing live proof isolated from candidate dependencies and validates manual preview origins', () => {
    for (const trustedWorkflow of [capability, proofmode]) {
      const preamble = trustedWorkflow.split('concurrency:')[0];
      expect(preamble).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
      expect(trustedWorkflow).toContain("trace:hasAccess?'off':'retain-on-failure'");
      expect(trustedWorkflow).toContain("steps.access-auth.outputs.enabled != 'true'");
      expect(trustedWorkflow).toContain('^[0-9a-f]{8}-chief-ai\\.mcgill-raylene\\.workers\\.dev$');
      expect(trustedWorkflow).toContain('x.app?.id===Number(process.env.CLOUDFLARE_CHECK_APP_ID)');
    }
  });

  it('keeps production ProofMode proof post-merge without impersonating it on pull requests', () => {
    expect(materializer).toContain('name: Production ProofMode phase receipt');
    expect(materializer).not.toContain('name: Verify production ProofMode MCP with Playwright');
    expect(materializer).toContain('This PR workflow does not impersonate that production receipt.');
    expect(productionProof).toContain('push:');
    expect(productionProof).toContain('- main');
    expect(productionProof).toContain('workflow_dispatch:');
    expect(productionProof).not.toContain('pull_request:');
  });
});
