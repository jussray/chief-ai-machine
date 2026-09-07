import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
  'utf8',
);

describe('ProofMode production governance workflow', () => {
  it('keeps production mutation founder-dispatched and exact-head bound', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('expected_sha:');
    expect(workflow).toContain('authorize_production:');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).toContain('test "$EXPECTED_HEAD_SHA" = "$GITHUB_SHA"');
    expect(workflow).toContain("if: github.event_name == 'workflow_dispatch'");
  });

  it('authenticates founder identity and makes production authority one-shot', () => {
    expect(workflow).toContain('REPOSITORY_OWNER: ${{ github.repository_owner }}');
    expect(workflow).toContain('TRIGGERING_ACTOR: ${{ github.triggering_actor }}');
    expect(workflow).toContain('test "$GITHUB_ACTOR" = "$REPOSITORY_OWNER"');
    expect(workflow).toContain('test "$TRIGGERING_ACTOR" = "$REPOSITORY_OWNER"');
    expect(workflow).toContain('test "$GITHUB_RUN_ATTEMPT" = "1"');
    expect(workflow).toContain('Bind authenticated founder authority to one exact dispatch');
  });

  it('requires the exact-head pre-production proof packet before promotion', () => {
    expect(workflow).toContain('Require exact-head pre-production proof packet');
    expect(workflow).toContain('"Typecheck"');
    expect(workflow).toContain('"Lint"');
    expect(workflow).toContain('"Unit Tests"');
    expect(workflow).toContain('"CodeQL"');
    expect(workflow).toContain('"Verify exact Chief runtime with Playwright"');
    expect(workflow).toContain('"Verify live Chief capability plan with Playwright"');
    expect(workflow).toContain('"Verify live ProofMode MCP with Playwright"');
    expect(workflow).toContain('"Verify operational authority"');
    expect(workflow).toContain('"Workers Builds: chief-ai"');
    expect(workflow).toContain('run.head_sha === process.env.EXPECTED_HEAD_SHA');
    expect(workflow).toContain('run.status === "completed"');
    expect(workflow).toContain('run.conclusion === "success"');
  });

  it('materializes both required deployment environments only through live proof', () => {
    expect(workflow).toContain('name: proofmode-access-admin');
    expect(workflow).toContain('name: Cloudflare Production');
    expect(workflow).toContain('Verify protected preview serves exact head');
    expect(workflow).toContain('Wait for production runtime to serve exact head');
    expect(workflow).toContain('Verify production ProofMode MCP with Playwright');
  });

  it('promotes the exact prebuilt Cloudflare version instead of rebuilding or weakening governance', () => {
    expect(workflow).toContain('Workers Builds: chief-ai');
    expect(workflow).toContain('Version ID:');
    expect(workflow).toContain('CLOUDFLARE_VERSION_ID');
    expect(workflow).toContain('npx wrangler versions deploy');
    expect(workflow).toContain('$CLOUDFLARE_VERSION_ID@100%');
    expect(workflow).toContain('--name chief-ai');
    expect(workflow).toContain('CLOUDFLARE_API_TOKEN');
    expect(workflow).toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(workflow).not.toContain('/rulesets/');
    expect(workflow).not.toContain('bypass');
  });

  it('requires protected Access proof before founder-dispatched production proof', () => {
    expect(workflow).toContain('needs: protected-access');
    expect(workflow).toContain("needs.protected-access.result == 'success'");
    expect(workflow).toContain('CF-Access-Client-Id');
    expect(workflow).toContain('CF-Access-Client-Secret');
    expect(workflow).toContain('npx playwright test --config=playwright.proofmode-access.config.mjs');
    expect(workflow).toContain('npx playwright test --config=playwright.proofmode-production.config.mjs');
  });
});
