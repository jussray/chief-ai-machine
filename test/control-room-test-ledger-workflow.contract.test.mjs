import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflow = await readFile('.github/workflows/control-room-test-ledger.yml', 'utf8');
const materializer = await readFile('.github/workflows/governance-required-check-materializer.yml', 'utf8');
const manifest = JSON.parse(await readFile('.control-room/test-ledger.manifest.json', 'utf8'));

describe('Control Room Test Ledger workflow contract', () => {
  it('materializes the ruleset-required ledger check on pull requests', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('name: Publish exact-head test ledger');
    expect(workflow).not.toContain("if: github.event_name != 'pull_request'");
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
    expect(runtimeSection).toContain('npx playwright test --config=playwright.chief-runtime-exact-head.config.mjs');
    expect(runtimeSection).not.toContain('Chief runtime surface changed; real exact-runtime Playwright proof is required.');
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

  it('inherits provider proof only across an unchanged governance/test-only tail', () => {
    const providerSection = materializer
      .split('  provider-receipt:')[1]
      .split('  founder-goals-applicability:')[0];

    expect(providerSection).toContain('Verify exact-head or unchanged-provider-tree receipt');
    expect(providerSection).toContain('has_provider_receipt');
    expect(providerSection).toContain('git rev-list --first-parent');
    expect(providerSection).toContain('git diff --name-only "$inherited_sha" "$EXPECTED_HEAD_SHA"');
    expect(providerSection).toContain("grep -Ev '^(\\.github/|test/)'");
    expect(providerSection).toContain('Provider receipt continuity proven');
    expect(providerSection).not.toContain('N/A proven from exact-head diff: provider/runtime surface unchanged.');
  });
});
