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

const FREESTYLE_REQUIRED = 'Verify Freestyle, Goalfix, and PromptOS in Chromium';
const FREESTYLE_TRUSTED = 'Verify Freestyle and Goalfix in Chromium';
const FREESTYLE_CANDIDATE = `${FREESTYLE_TRUSTED} (candidate evidence only)`;

describe('Control Room Test Ledger workflow contract', () => {
  it('materializes the ruleset-required ledger check and fails closed on prerequisite failure', () => {
    const publishSection = workflow.split('  publish-ledger:')[1];
    expect(workflow).toContain('pull_request:');
    expect(publishSection).toContain('name: Publish exact-head test ledger');
    expect(publishSection).toContain('if: ${{ always() }}');
    expect(publishSection).toContain('LEDGER_CONTRACT_RESULT: ${{ needs.ledger-contract.result }}');
    expect(publishSection).toContain('test "$LEDGER_CONTRACT_RESULT" = \'success\'');
  });

  it('materializes Sonar instead of leaving a dependency-skipped required context', () => {
    const sonarSection = quality.split('  sonarqube:')[1];
    expect(sonarSection).toContain('name: "SonarQube – Founder Intelligence"');
    expect(sonarSection).toContain('if: ${{ always() }}');
    expect(sonarSection).toContain('UNIT_TEST_RESULT: ${{ needs.unit-tests.result }}');
    expect(sonarSection).toContain('test "$UNIT_TEST_RESULT" = \'success\'');
  });

  it('keeps the observer outside the authority set', () => {
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

  it('provides a real exact-runtime browser path without candidate packages or candidate secrets', () => {
    const runtimeSection = materializer.split('  runtime-proof:')[1].split('  production-proofmode-phase:')[0];
    expect(runtimeSection).toContain('name: Verify exact Chief runtime with Playwright');
    expect(runtimeSection).toContain('Resolve authenticated exact-head Cloudflare preview');
    expect(runtimeSection).toContain('Install isolated trusted Playwright runner');
    expect(runtimeSection).toContain('Run trusted exact-runtime browser proof');
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/version`');
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/`');
    expect(runtimeSection).toContain("getByRole('heading',{name:'What are we trying to accomplish?'})");
    expect(runtimeSection).toContain('page.goto(`${baseUrl}/styles/main.css`');
    expect(runtimeSection).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(runtimeSection).not.toContain('CF-Access-Client-Secret');
  });

  it('treats deployed SPA assets and both sides of renames as runtime changes', () => {
    const runtimeSection = materializer.split('  runtime-proof:')[1].split('  production-proofmode-phase:')[0];
    expect(runtimeSection).toContain('index\\.html$');
    expect(runtimeSection).toContain('styles/');
    expect(runtimeSection).toContain('src/');
    expect(runtimeSection).toContain('\\.assetsignore$');
    expect(runtimeSection).toContain('git diff --no-renames --name-only');
  });

  it('authenticates Cloudflare provenance and includes the base in inheritance search', () => {
    const providerSection = materializer.split('  provider-receipt:')[1].split('  runtime-proof:')[0];
    expect(materializer).toContain("CLOUDFLARE_CHECK_APP_ID: '85455'");
    expect(providerSection).toContain('x.app?.id===Number(process.env.CLOUDFLARE_CHECK_APP_ID)');
    expect(providerSection).toContain("printf '%s\\n' \"$BASE_SHA\"");
    expect(providerSection).toContain('git diff --no-renames --name-only "$inherited_sha" "$EXPECTED_HEAD_SHA"');
    expect(providerSection).toContain("grep -Ev '^(\\.github/|test/|vitest\\.config\\.js$)'");
  });

  it('gives each feature required context one authoritative producer without candidate impersonation', () => {
    expect(materializer).not.toContain('name: Verify Founder Goals desktop and mobile flow');
    expect(materializer).not.toContain(`name: ${FREESTYLE_REQUIRED}`);
    expect(materializer).not.toContain('name: Verify live Chief capability plan with Playwright');
    expect(materializer).not.toContain('name: Verify live ProofMode MCP with Playwright');
    expect(founderGoals).toContain('name: Verify Founder Goals desktop and mobile flow');
    expect(capability).toContain('name: Verify live Chief capability plan with Playwright');
    expect(proofmode).toContain('name: Verify live ProofMode MCP with Playwright');
    expect(freestyle).toContain(`github.event_name == 'pull_request_target' && '${FREESTYLE_TRUSTED}'`);
    expect(freestyle).toContain(`'${FREESTYLE_CANDIDATE}'`);
    expect(freestyle).toContain(`REQUIRED_CHECK_NAME: ${FREESTYLE_REQUIRED}`);
  });

  it('keeps authoritative feature proof on pull_request_target while allowing read-only candidate evidence', () => {
    for (const trustedWorkflow of [founderGoals, capability, proofmode]) {
      expect(trustedWorkflow).toContain('pull_request_target:');
      expect(trustedWorkflow).not.toMatch(/\n {2}pull_request:\n/);
      expect(trustedWorkflow).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
      expect(trustedWorkflow).toContain('git diff --no-renames --name-only');
      expect(trustedWorkflow).toContain('ref: ${{ env.TRUSTED_EVALUATOR_SHA }}');
    }

    const freestyleVerifySection = freestyle.split('  verify:')[1].split('  publish-candidate-required-check:')[0];
    const freestylePublisherSection = freestyle.split('  publish-candidate-required-check:')[1];

    expect(freestyle).toContain('pull_request_target:');
    expect(freestyle).toMatch(/\n {2}pull_request:\n/);
    expect(freestyle).toContain(`github.event_name == 'pull_request_target' && '${FREESTYLE_TRUSTED}'`);
    expect(freestyle).toContain(`'${FREESTYLE_CANDIDATE}'`);
    expect(freestyle).toContain(`REQUIRED_CHECK_NAME: ${FREESTYLE_REQUIRED}`);
    expect(freestyle).toContain('${{ github.event_name }}');
    expect(freestyle).toContain('permissions:\n  contents: read');

    expect(freestyleVerifySection).not.toContain('pull-requests: write');
    expect(freestyleVerifySection).not.toContain('checks: write');
    expect(freestyleVerifySection).not.toContain('secrets.');

    expect(freestylePublisherSection).toContain("if: always() && github.event_name == 'pull_request_target'");
    expect(freestylePublisherSection).toContain('permissions:\n      checks: write');
    expect(freestylePublisherSection).toContain('head_sha: process.env.EXPECTED_HEAD_SHA');
    expect(freestylePublisherSection).not.toContain('pull-requests: write');
    expect(freestylePublisherSection).not.toContain('secrets.');
  });

  it('keeps candidate runtime proof credential-free', () => {
    for (const trustedWorkflow of [materializer, capability, proofmode]) {
      expect(trustedWorkflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_ID');
      expect(trustedWorkflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
      expect(trustedWorkflow).not.toContain('CF-Access-Client-Id');
      expect(trustedWorkflow).not.toContain('CF-Access-Client-Secret');
    }
    expect(capability).toContain('Long-lived Access credentials are intentionally withheld from candidate runtime.');
    expect(proofmode).toContain('Long-lived Access credentials are intentionally withheld from candidate runtime.');
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
