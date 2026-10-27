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
    expect(workflow).toContain('activation_run_id:');
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

  it('authenticates a workflow-to-workflow dispatch through exact founder bridge run metadata', () => {
    expect(bridge).toContain('activation_run_id: process.env.ACTIVATION_RUN_ID');
    expect(workflow).toContain("ACTIVATION_RUN_ID: ${{ github.event_name == 'workflow_dispatch' && inputs.activation_run_id || '' }}");
    expect(authorityScript).toContain("activation.path !== BRIDGE_WORKFLOW_PATH");
    expect(authorityScript).toContain("activation.event !== 'pull_request'");
    expect(authorityScript).toContain('activation.actor?.login !== repositoryOwner');
    expect(authorityScript).toContain('activation.triggering_actor?.login !== repositoryOwner');
    expect(authorityScript).toContain('activation.head_sha !== expectedSha');
    expect(authorityScript).toContain("authenticatedBy: directFounder ? 'direct-founder' : 'founder-bridge'");
  });

  it('rejects reruns and brand-new dispatch replay of the same authority receipt', () => {
    expect(authorityScript).toContain("runAttempt !== '1'");
    expect(authorityScript).toContain('Authority receipt has already been consumed');
    expect(authorityScript).toContain('proofmode-production-authority-consumed:v1');
    expect(workflow).toContain('finalize-authority:');
    expect(workflow).toContain('Consume attempted one-shot authority');
    expect(workflow).not.toContain('Consume founder authority before production mutation');
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

  it('waits for the exact-head Cloudflare build receipt instead of failing on stale check attempts', () => {
    const begin = workflow.indexOf('      - name: Resolve exact-head Cloudflare build and Version ID');
    const end = workflow.indexOf('      - name: Require exact-head pre-production proof packet', begin);
    const step = workflow.slice(begin, end);
    expect(begin).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(begin);
    expect(step).toContain('check-runs?per_page=100');
    expect(step).toContain('run.head_sha === process.env.EXPECTED_HEAD_SHA');
    expect(step).toContain('for attempt in {1..90}; do');
    expect(step).toContain('CLOUDFLARE_VERSION_ID=%s');
    // No exit 1 can precede the retry-loop deadline.
    const deadline = step.indexOf('          done');
    expect(deadline).toBeGreaterThan(0);
    expect(step.slice(0, deadline)).not.toContain('exit 1');
    expect(step.slice(deadline)).toContain('exit 1');
  });

  it('requires an artifact if production Playwright ran, but does not mask upstream failures', () => {
    expect(workflow).toContain('id: proofmode_production_test');
    expect(workflow).toContain(
      "if: always() && (steps.proofmode_production_test.outcome == 'success' || steps.proofmode_production_test.outcome == 'failure')",
    );
    expect(workflow).toContain('if-no-files-found: error');
  });

  it('uses the existing scoped Access token only in the production runtime proof job', () => {
    const begin = workflow.indexOf('  production-proof:');
    const end = workflow.indexOf('  finalize-authority:', begin);
    const job = workflow.slice(begin, end);
    expect(begin).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(begin);
    expect(job).toContain('name: proofmode-access-admin');
    expect(job).toContain('CLOUDFLARE_ACCESS_CLIENT_ID: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}');
    expect(job).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
    expect(job).toContain('CF-Access-Client-Id: $CLOUDFLARE_ACCESS_CLIENT_ID');
    expect(job).toContain('CF-Access-Client-Secret: $CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(job).toContain("'CF-Access-Client-Id': process.env.CLOUDFLARE_ACCESS_CLIENT_ID");
    expect(job).toContain("'CF-Access-Client-Secret': process.env.CLOUDFLARE_ACCESS_CLIENT_SECRET");
    expect(job).toContain('name: Verify production ProofMode MCP with Playwright');
    expect(job).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(job).not.toContain('deployments: write');
  });

  it('materializes both required deployment environments only through live proof', () => {
    expect(workflow).toContain('name: proofmode-access-admin');
    expect(workflow).toContain('name: Cloudflare Production');
    expect(workflow).toContain('Verify protected preview serves exact head');
    expect(workflow).toContain('Wait for production runtime to serve exact head');
    expect(workflow).toContain('Verify production ProofMode MCP with Playwright');
  });

  it('classifies Access redirects before checking runtime identity', () => {
    expect(workflow).toContain("--write-out '%{http_code}'");
    expect(workflow).toContain(
      'Protected preview returned HTTP %s redirect; Cloudflare Access service-token policy/binding did not grant direct access',
    );
    expect(workflow).toContain('Protected preview returned HTTP 200 but /version exposed no release sha');
    expect(workflow).toContain('Protected preview release sha mismatch');
  });

  it('consumes one-shot authority after every attempted dispatched execution', () => {
    expect(workflow).toContain('finalize-authority:');
    expect(workflow).toContain('needs: [protected-access, verify, production-proof]');
    expect(workflow).toContain("if: always() && github.event_name == 'workflow_dispatch'");
    expect(workflow).toContain('Consume attempted one-shot authority');
    expect(workflow).toContain('issues: write');
    const finalizer = workflow.slice(workflow.indexOf('  finalize-authority:'));
    expect(finalizer).toContain('      pull-requests: write');
    expect(workflow).toContain('node scripts/proofmode-production-authority.mjs consume');
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
    expect(workflow).toContain('needs: [protected-access, verify]');
    expect(workflow).toContain("needs.protected-access.result == 'success'");
    expect(workflow).toContain('CF-Access-Client-Id');
    expect(workflow).toContain('CF-Access-Client-Secret');
    expect(workflow).toContain('npx playwright test --config=playwright.proofmode-access.config.mjs');
    expect(workflow).toContain('npx playwright test --config=playwright.proofmode-production.config.mjs');
  });

  it('adds a founder-only PR bridge that can dispatch through GitHub without weakening the production gate', () => {
    expect(bridge).toContain('ready_for_review');
    expect(bridge).toContain('github.actor == github.repository_owner');
    expect(bridge).toContain('github.triggering_actor == github.repository_owner');
    expect(bridge).toContain('github.event.pull_request.user.login == github.repository_owner');
    expect(bridge).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(bridge).toContain('proofmode-production-authority.mjs discover');
    expect(bridge).toContain('/actions/workflows/proofmode-production-playwright.yml/dispatches');
    expect(bridge).toContain('authorize_production: true');
    expect(bridge).toContain('cancel-in-progress: true');
  });
});
