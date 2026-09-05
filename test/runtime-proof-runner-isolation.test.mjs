import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflows = [
  ['ProofMode MCP', '../.github/workflows/proofmode-mcp-playwright.yml'],
  ['Chief capability plan', '../.github/workflows/chief-capability-plan-playwright.yml'],
];

describe('credential-bearing runtime proof runner isolation', () => {
  it.each(workflows)('%s keeps PR execution secretless and privileged runtime proof manual-only', (_name, relativePath) => {
    const workflow = readFileSync(new globalThis.URL(relativePath, import.meta.url), 'utf8');
    const sourceStart = workflow.indexOf('  source-contract:');
    const prGateStart = workflow.indexOf('  pr-runtime-gate:');
    const runtimeStart = workflow.indexOf('  runtime-proof:');
    const sourceSection = workflow.slice(sourceStart, prGateStart);
    const prGateSection = workflow.slice(prGateStart, runtimeStart);
    const runtimeSection = workflow.slice(runtimeStart);

    expect(sourceStart).toBeGreaterThanOrEqual(0);
    expect(prGateStart).toBeGreaterThan(sourceStart);
    expect(runtimeStart).toBeGreaterThan(prGateStart);

    expect(sourceSection).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(sourceSection).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(sourceSection).not.toContain('environment: proofmode-access-admin');

    expect(prGateSection).toContain("github.event_name == 'pull_request'");
    expect(prGateSection).toContain('PR-authored workflow code is not permitted to enter proofmode-access-admin');
    expect(prGateSection).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(prGateSection).not.toContain('environment: proofmode-access-admin');

    expect(runtimeSection).toMatch(/needs:\n(?:\s+- [^\n]+\n)*\s+- source-contract/);
    expect(runtimeSection).toContain("github.event_name == 'workflow_dispatch'");
    expect(runtimeSection).toContain('environment: proofmode-access-admin');
    expect(runtimeSection).toContain('TRUSTED_BASE_SHA');
    expect(runtimeSection).toContain('ref: ${{ env.TRUSTED_BASE_SHA }}');
    expect(runtimeSection).toContain('Reacquire current main before privileged');
    expect(runtimeSection).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');

    const trustedCheckout = runtimeSection.search(/name: Check out immutable trusted .*browser-proof source/);
    const firstAccessSecret = runtimeSection.indexOf('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
    expect(trustedCheckout).toBeGreaterThanOrEqual(0);
    expect(firstAccessSecret).toBeGreaterThan(trustedCheckout);
  });
});
