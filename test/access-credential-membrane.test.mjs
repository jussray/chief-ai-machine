import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Founder decision 2026-11-18: Cloudflare Access service-token secrets are
// released only to founder-dispatched (workflow_dispatch) runs. Workflows
// that also run on pull_request execute branch code and must stay
// credential-free there. Authenticated runs must never retain
// credential-bearing traces, screenshots, videos, or reports.
const GATED_ID = "CLOUDFLARE_ACCESS_CLIENT_ID: ${{ github.event_name == 'workflow_dispatch' && secrets.CLOUDFLARE_ACCESS_CLIENT_ID || '' }}";
const GATED_SECRET = "CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ github.event_name == 'workflow_dispatch' && secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET || '' }}";
const UNGATED = /CLOUDFLARE_ACCESS_CLIENT_(?:ID|SECRET): \$\{\{ secrets\./g;

const workflows = {
  '../.github/workflows/proofmode-mcp-playwright.yml': (workflow) => {
    // Evidence is a redacted receipt only; the browser never records traces or media.
    expect(workflow).toContain("use:{trace: 'off', screenshot: 'off', video: 'off'}");
    expect(workflow).toContain('path: artifacts/proofmode-mcp-safe.json');
    expect(workflow).not.toMatch(/path:[^\n]*(?:playwright-report|test-results)/);
  },
  '../.github/workflows/chief-capability-plan-playwright.yml': (workflow) => {
    // Authenticated runs disable traces and never upload the report.
    expect(workflow).toContain("ACCESS_AUTH_CONFIGURED: ${{ github.event_name == 'workflow_dispatch' && secrets.CLOUDFLARE_ACCESS_CLIENT_ID != '' && secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET != '' }}");
    expect(workflow).toContain("trace: authenticated ? 'off' : 'retain-on-failure'");
    expect(workflow).toContain('reporter: authenticated');
    expect(workflow).toContain("if: always() && env.ACCESS_AUTH_CONFIGURED != 'true'");
  },
};

function readWorkflow(relativePath) {
  return readFileSync(new globalThis.URL(relativePath, import.meta.url), 'utf8');
}

describe('Cloudflare Access credential membrane', () => {
  for (const [relativePath, assertArtifactsSafe] of Object.entries(workflows)) {
    it(`${relativePath} releases Access secrets only to workflow_dispatch and keeps them out of artifacts`, () => {
      const workflow = readWorkflow(relativePath);
      const jobsIndex = workflow.indexOf('\njobs:');
      expect(jobsIndex).toBeGreaterThan(0);

      const topLevel = workflow.slice(0, jobsIndex);
      expect(topLevel).toContain(GATED_ID);
      expect(topLevel).toContain(GATED_SECRET);
      expect(workflow.match(UNGATED) || []).toHaveLength(0);

      assertArtifactsSafe(workflow);
    });
  }
});
