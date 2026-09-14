import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflows = [
  ['ProofMode MCP', '../.github/workflows/proofmode-mcp-playwright.yml'],
  ['Chief capability plan', '../.github/workflows/chief-capability-plan-playwright.yml'],
];

describe('credential-bearing runtime proof runner isolation', () => {
  it.each(workflows)('%s keeps PR execution secretless and trusted runtime evidence default-main only', (_name, relativePath) => {
    const workflow = readFileSync(new globalThis.URL(relativePath, import.meta.url), 'utf8');
    const sourceStart = workflow.indexOf('  source-contract:');
    const dispatchStart = workflow.indexOf('  dispatch-identity:');
    const evidenceStart = workflow.indexOf('  trusted-runtime-evidence:');

    expect(sourceStart).toBeGreaterThanOrEqual(0);
    expect(dispatchStart).toBeGreaterThan(sourceStart);
    expect(evidenceStart).toBeGreaterThan(dispatchStart);
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).toContain('repository_dispatch:');

    const sourceSection = workflow.slice(sourceStart, dispatchStart);
    expect(sourceSection).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(sourceSection).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(sourceSection).not.toContain('environment: proofmode-access-admin');

    const dispatchSection = workflow.slice(dispatchStart, evidenceStart);
    expect(dispatchSection).toContain("github.event_name == 'repository_dispatch'");
    expect(dispatchSection).toContain('EVENT_REF: ${{ github.ref }}');
    expect(dispatchSection).toContain('WORKFLOW_SHA: ${{ github.sha }}');
    expect(dispatchSection).toContain('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}');
    expect(dispatchSection).toContain('current_main');
    expect(dispatchSection).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(dispatchSection).not.toContain('environment: proofmode-access-admin');

    const evidenceSection = workflow.slice(evidenceStart);
    expect(evidenceSection).toContain("github.event_name == 'repository_dispatch'");
    expect(evidenceSection).toContain('environment: proofmode-access-admin');
    expect(evidenceSection).toContain('ref: ${{ github.sha }}');
    expect(evidenceSection).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
    expect(evidenceSection).not.toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
  });

  it('keeps the reserved candidate authority context out of GitHub Actions', () => {
    const proofMode = readFileSync(
      new globalThis.URL('../.github/workflows/proofmode-mcp-playwright.yml', import.meta.url),
      'utf8',
    );
    expect(proofMode).not.toContain('Verify candidate ProofMode runtime with Playwright');
    expect(proofMode).toContain('ProofMode trusted runtime evidence');
  });
});
