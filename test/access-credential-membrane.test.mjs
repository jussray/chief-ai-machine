import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflows = [
  '../.github/workflows/proofmode-mcp-playwright.yml',
  '../.github/workflows/chief-capability-plan-playwright.yml',
];

function readWorkflow(relativePath) {
  return readFileSync(new globalThis.URL(relativePath, import.meta.url), 'utf8');
}

describe('Cloudflare Access credential membrane', () => {
  for (const relativePath of workflows) {
    it(`${relativePath} keeps Access secrets out of job-wide env and credential-bearing artifacts`, () => {
      const workflow = readWorkflow(relativePath);
      const jobsIndex = workflow.indexOf('\njobs:');
      expect(jobsIndex).toBeGreaterThan(0);

      const topLevel = workflow.slice(0, jobsIndex);
      expect(topLevel).not.toContain('CLOUDFLARE_ACCESS_CLIENT_ID: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}');
      expect(topLevel).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
      expect(topLevel).toContain("ACCESS_AUTH_CONFIGURED: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID != '' && secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET != '' }}");

      const clientIdRefs = workflow.match(/CLOUDFLARE_ACCESS_CLIENT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCESS_CLIENT_ID \}\}/g) || [];
      const secretRefs = workflow.match(/CLOUDFLARE_ACCESS_CLIENT_SECRET: \$\{\{ secrets\.CLOUDFLARE_ACCESS_CLIENT_SECRET \}\}/g) || [];
      expect(clientIdRefs).toHaveLength(2);
      expect(secretRefs).toHaveLength(2);

      expect(workflow).toContain("trace: authenticated ? 'off' : 'retain-on-failure'");
      expect(workflow).toContain("reporter: authenticated");
      expect(workflow).toContain("if: always() && env.ACCESS_AUTH_CONFIGURED != 'true'");
    });
  }
});
