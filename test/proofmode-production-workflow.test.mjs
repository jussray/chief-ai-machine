import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
  'utf8',
);
const bridge = readFileSync(
  new URL('../.github/workflows/proofmode-production-authority-bridge.yml', import.meta.url),
  'utf8',
);
const authorityScript = readFileSync(
  new URL('../scripts/proofmode-production-authority.mjs', import.meta.url),
  'utf8',
);

describe('ProofMode production governance workflow', () => {
  it('keeps production mutation founder-dispatched and exact-head bound', () => {
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('expected_sha:');
    expect(workflow).toContain('authority_pr:');
    expect(workflow).toContain('authority_receipt:');
    expect(workflow).toContain('authorize_production:');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).toContain('test "$EXPECTED_HEAD_SHA" = "$GITHUB_SHA"');
    expect(workflow).toContain("if: github.event_name == 'workflow_dispatch'");
  });

  it('binds authority to a durable exact-head GitHub review receipt', () => {
    expect(workflow).toContain('proofmode-production-authority.mjs validate');
    expect(authorityScript).toContain('review.commit_id !== expectedSha');
    expect(authorityScript).toContain("review.author_association !== 'OWNER'");
    expect(authorityScript).toContain('Authority receipt is not founder-authored');
    expect(authorityScript).toContain('Authority PR head moved');
    expect(authorityScript).toContain(
      'PRODUCTION_ACTION_AUTHORIZED / EXACT_HEAD_BOUND / ONE_SHOT / MERGE_HOLD.',
    );
  });

  it('rejects reruns and brand-new dispatch replay of the same authority receipt', () => {
    expect(authorityScript).toContain("runAttempt !== '1'");
    expect(authorityScript).toContain('Authority receipt has already been consumed');
    expect(authorityScript).toContain('proofmode-production-authority-consumed:v1');
    expect(workflow).toContain('Consume founder authority before production mutation');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('inputs.authority_receipt');
  });

  it('never cancels an in-flight production mutation to start a newer proof', () => {
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).not.toContain('cancel-in-progress: true');
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

  it('adds a founder-only PR bridge that can dispatch through GitHub without weakening the production gate', () => {
    expect(bridge).toContain('ready_for_review');
    expect(bridge).toContain('github.actor == github.repository_owner');
    expect(bridge).toContain('github.event.pull_request.user.login == github.repository_owner');
    expect(bridge).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(bridge).toContain('proofmode-production-authority.mjs discover');
    expect(bridge).toContain('/actions/workflows/proofmode-production-playwright.yml/dispatches');
    expect(bridge).toContain('authorize_production: true');
    expect(bridge).toContain('cancel-in-progress: true');
  });
});
