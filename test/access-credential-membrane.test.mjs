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
  it('keeps deployment ProofMode proof restricted to protected secrets and credential-safe artifacts', () => {
    const workflow = readWorkflow('../.github/workflows/cloudflare-workers-deploy.yml');
    const deployment = workflow.split('\n  build-and-deploy:')[1]?.split('\n  verify-production:')[0] || '';
    const verify = workflow.split('\n  verify-production:')[1] || '';
    const e2e = readWorkflow('../e2e/proofmode-mcp.pw.mjs');

    expect(deployment).not.toContain('CLOUDFLARE_ACCESS_CLIENT_');
    expect(verify).toContain('name: Cloudflare Production');
    expect(verify).toContain('CLOUDFLARE_ACCESS_CLIENT_ID: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}');
    expect(verify).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
    expect(verify).toContain("PROOFMODE_ACCESS_REQUIRED: 'true'");
    expect(verify).toContain('PROOFMODE_ACCESS_CREDENTIALS_REQUIRED');
    expect(verify).toContain("trace: 'off'");
    expect(verify).toContain("screenshot: 'off'");
    expect(verify).toContain("video: 'off'");
    expect(verify).toContain('scripts/proofmode-safe-reporter.mjs');
    expect(verify).not.toContain("['html',");
    expect(verify).not.toContain('playwright-report/deployment-verify');
    expect(e2e).toContain("proofmodeAccessHeaders(process.env, baseURL, process.env.PROOFMODE_ACCESS_REQUIRED === 'true')");
    expect(e2e).toContain("proofmodeRequest(request, baseURL, '/version', process.env)");
    expect(e2e).toContain("proofmodeRequest(request, baseURL, '/mcp', process.env");
  });

});
