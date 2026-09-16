import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflow = await readFile('.github/workflows/control-room-test-ledger.yml', 'utf8');
const quality = await readFile('.github/workflows/quality-gate.yml', 'utf8');
const materializer = await readFile('.github/workflows/governance-required-check-materializer.yml', 'utf8');
const productionProof = await readFile('.github/workflows/proofmode-production-playwright.yml', 'utf8');
const manifest = JSON.parse(await readFile('.control-room/test-ledger.manifest.json', 'utf8'));

describe('Control Room Test Ledger workflow contract', () => {
  it('materializes the ruleset-required ledger check on pull requests and fails closed on prerequisite failure', () => {
    const publishSection = workflow.split('  publish-ledger:')[1];
    expect(workflow).toContain('pull_request:');
    expect(publishSection).toContain('name: Publish exact-head test ledger');
    expect(publishSection).toContain('if: ${{ always() }}');
    expect(publishSection).toContain('LEDGER_CONTRACT_RESULT: ${{ needs.ledger-contract.result }}');
    expect(publishSection).toContain('test "$LEDGER_CONTRACT_RESULT" = \'success\'');
    expect(workflow).not.toContain("if: github.event_name != 'pull_request'");
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

  it('provides a real exact-runtime Playwright path when runtime scope changes', () => {
    const runtimeSection = materializer
      .split('  runtime-applicability:')[1]
      .split('  capability-plan-applicability:')[0];

    expect(runtimeSection).toContain('name: Verify exact Chief runtime with Playwright');
    expect(runtimeSection).toContain('Resolve exact Cloudflare commit preview');
    expect(runtimeSection).toContain('Run exact-runtime browser proof');
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/version`');
    expect(runtimeSection).toContain('expect(payload?.sha).toBe(expectedSha)');
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/`');
    expect(runtimeSection).toContain("getByRole('heading', { name: 'What are we trying to accomplish?' })");
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/styles/main.css`');
    expect(runtimeSection).toContain('npx playwright test --config=playwright.chief-runtime-exact-head.config.mjs');
    expect(runtimeSection).not.toContain('Chief runtime surface changed; real exact-runtime Playwright proof is required.');
  });

  it('treats deployed SPA assets and asset-policy changes as runtime changes', () => {
    const runtimeSection = materializer
      .split('  runtime-applicability:')[1]
      .split('  capability-plan-applicability:')[0];

    expect(runtimeSection).toContain('index\\.html$');
    expect(runtimeSection).toContain('styles/');
    expect(runtimeSection).toContain('src/');
    expect(runtimeSection).toContain('\\.assetsignore$');
    expect(runtimeSection).toContain('git diff --no-renames --name-only');
  });

  it('authenticates Cloudflare check-run provenance instead of trusting the check name alone', () => {
    const providerSection = materializer
      .split('  provider-receipt:')[1]
      .split('  founder-goals-applicability:')[0];
    const runtimeSection = materializer
      .split('  runtime-applicability:')[1]
      .split('  capability-plan-applicability:')[0];

    expect(materializer).toContain("CLOUDFLARE_CHECK_APP_ID: '85455'");
    expect(providerSection).toContain('x.app?.id === expectedApp');
    expect(runtimeSection).toContain('x.app?.id===expectedApp');
  });

  it('isolates Playwright from candidate package metadata and does not retain Access-authenticated traces', () => {
    const preamble = materializer.split('concurrency:')[0];
    const runtimeSection = materializer
      .split('  runtime-applicability:')[1]
      .split('  capability-plan-applicability:')[0];

    expect(preamble).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(runtimeSection).toContain('runner_dir="${RUNNER_TEMP}/chief-runtime-playwright"');
    expect(runtimeSection).toContain("trace: hasAccess ? 'off' : 'retain-on-failure'");
    expect(runtimeSection).toContain("steps.access-auth.outputs.enabled != 'true'");
    expect(runtimeSection).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
  });

  it('does not force runtime Playwright for governance-only materializer edits', () => {
    const runtimeSection = materializer
      .split('  runtime-applicability:')[1]
      .split('  capability-plan-applicability:')[0];

    expect(runtimeSection).not.toContain('governance-required-check-materializer');
    expect(runtimeSection).toContain('worker/');
    expect(runtimeSection).toContain('wrangler\\.jsonc$');
    expect(runtimeSection).toContain('e2e/');
  });

  it('keeps production ProofMode proof post-merge instead of making PRs prove production', () => {
    const productionSection = materializer.split('  proofmode-production-applicability:')[1];

    expect(productionSection).toContain('name: Verify production ProofMode MCP with Playwright');
    expect(productionSection).toContain('Production ProofMode is post-merge/current-main proof');
    expect(productionSection).toContain('pre-merge candidate proof remains separate');
    expect(productionSection).not.toContain('Production ProofMode surface changed; production proof remains mandatory.');
    expect(productionSection).not.toContain('exit 1');

    expect(productionProof).toContain('push:');
    expect(productionProof).toContain('- main');
    expect(productionProof).toContain('workflow_dispatch:');
    expect(productionProof).not.toContain('pull_request:');
  });

  it('inherits provider proof only across an unchanged governance/test-only tail', () => {
    const providerSection = materializer
      .split('  provider-receipt:')[1]
      .split('  founder-goals-applicability:')[0];

    expect(providerSection).toContain('Verify exact-head or unchanged-provider-tree receipt');
    expect(providerSection).toContain('has_provider_receipt');
    expect(providerSection).toContain('git rev-list --first-parent');
    expect(providerSection).toContain('git diff --no-renames --name-only "$inherited_sha" "$EXPECTED_HEAD_SHA"');
    expect(providerSection).toContain("grep -Ev '^(\\.github/|test/|vitest\\.config\\.js$)'");
    expect(providerSection).toContain('Provider receipt continuity proven');
    expect(providerSection).not.toContain('N/A proven from exact-head diff: provider/runtime surface unchanged.');
  });

  it('does not treat root Vitest configuration as provider-affecting runtime state', () => {
    const providerSection = materializer
      .split('  provider-receipt:')[1]
      .split('  founder-goals-applicability:')[0];

    expect(providerSection).toContain('vitest\\.config\\.js$');
    expect(providerSection).toContain('only non-runtime governance/test files changed');
  });
});
