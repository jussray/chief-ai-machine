import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflows = [
  ['ProofMode MCP', '../.github/workflows/proofmode-mcp-playwright.yml'],
  ['Chief capability plan', '../.github/workflows/chief-capability-plan-playwright.yml'],
];

describe('credential-bearing runtime proof runner isolation', () => {
  it.each(workflows)('%s keeps PR-head execution and Access secrets in separate jobs', (_name, relativePath) => {
    const workflow = readFileSync(new globalThis.URL(relativePath, import.meta.url), 'utf8');
    const sourceStart = workflow.indexOf('  source-contract:');
    const runtimeStart = workflow.indexOf('  runtime-proof:');
    const sourceSection = workflow.slice(sourceStart, runtimeStart);
    const runtimeSection = workflow.slice(runtimeStart);

    expect(sourceStart).toBeGreaterThanOrEqual(0);
    expect(runtimeStart).toBeGreaterThan(sourceStart);
    expect(sourceSection).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(sourceSection).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(sourceSection).not.toContain('environment: proofmode-access-admin');

    expect(runtimeSection).toMatch(/needs:(?: source-contract|\n(?:\s+- [^\n]+\n)*\s+- source-contract)/);
    expect(runtimeSection).toContain('environment: proofmode-access-admin');
    expect(runtimeSection).toContain("ref: ${{ github.event.pull_request.base.sha || 'main' }}");
    expect(runtimeSection).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');

    const trustedCheckout = runtimeSection.indexOf('name: Check out trusted base runtime proof source');
    const firstShell = runtimeSection.indexOf('shell: bash');
    expect(trustedCheckout).toBeGreaterThanOrEqual(0);
    expect(firstShell).toBeGreaterThan(trustedCheckout);
  });
});
