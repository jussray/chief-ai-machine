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
    // No browser traces or media at all, even on unauthenticated redirects.
    expect(workflow).toContain("trace: 'off', screenshot: 'off', video: 'off'");
    expect(workflow).toContain("reporter: [['line']]");
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
      if (relativePath.includes('chief-capability-plan')) {
        // Candidate base-controlled runs never inherit secrets through the job
        // environment. Dispatch-gated credentials may appear only on the
        // exact provider-identity and browser-proof steps.
        expect(topLevel).not.toContain(GATED_ID);
        expect(topLevel).not.toContain(GATED_SECRET);
        const protectedStep = workflow.split('      - name: Verify provider-issued Cloudflare preview identity')[1].split('      - name: Preserve provider-admin block classification')[0];
        const browserStep = workflow.split('      - name: Run live Chief capability-plan Playwright proof')[1].split('      - name: Retain Playwright report')[0];
        for (const step of [protectedStep, browserStep]) {
          expect(step).toContain(GATED_ID);
          expect(step).toContain(GATED_SECRET);
        }
        expect(workflow.split(GATED_ID).length - 1).toBe(2);
        expect(workflow.split(GATED_SECRET).length - 1).toBe(2);
      } else {
        expect(topLevel).toContain(GATED_ID);
        expect(topLevel).toContain(GATED_SECRET);
      }
      expect(workflow.match(UNGATED) || []).toHaveLength(0);

      assertArtifactsSafe(workflow);
    });
  }
});
