import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectTrustedChiefPreview, selectTrustedChiefVersion } from '../scripts/validate-chief-preview.mjs';

const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const appId = 85455;
const validUrl = 'https://1234abcd-chief-ai.mcgill-raylene.workers.dev';
const validVersion = '1234abcd-e89b-12d3-a456-426614174000';
const build = (patch = {}) => ({
  name: 'Workers Builds: chief-ai',
  head_sha: sha,
  app: { id: appId },
  status: 'completed',
  conclusion: 'success',
  output: { summary: `Version ID: ${validVersion}\nPreview URL: ${validUrl}\n` },
  ...patch,
});
const response = (...checks) => ({ check_runs: checks });

describe('trusted exact-head Chief preview resolution', () => {
  it('requires the production workflow to call the trusted parser before sending Access headers', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain('node scripts/validate-chief-preview.mjs');
    expect(workflow).toContain("CLOUDFLARE_CHECK_APP_ID: '85455'");
    expect(workflow).not.toContain('const run = (data.check_runs || []).find((item) =>');
  });

  it('retains only credential-safe Playwright receipts from protected and production runs', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
      'utf8',
    );
    for (const phase of ['access', 'production']) {
      expect(workflow).toContain(`./artifacts/proofmode-${phase}-safe.json`);
    }
    expect(workflow).toContain("'./scripts/proofmode-safe-reporter.mjs'");
    expect(workflow).not.toContain("trace: 'retain-on-failure'");
    expect(workflow).not.toContain('playwright-report/proofmode-access');
    expect(workflow).not.toContain('playwright-report/proofmode-production');
    expect(workflow).not.toContain('test-results/proofmode-access\n');
    expect(workflow).not.toContain('test-results/proofmode-production\n');
  });

  it('uses the same trusted parser for release-version selection and all check pages', () => {
    const workflow = readFileSync(
      new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
      'utf8',
    );
    expect(workflow).toContain('node scripts/validate-chief-preview.mjs version');
    expect(workflow.match(/check-runs\?per_page=100/g)?.length).toBeGreaterThanOrEqual(3);
    expect(workflow).not.toContain('(run) => run.name === "Workers Builds: chief-ai"');
  });

  it('selects a version only from the exact-head trusted Cloudflare build', () => {
    expect(selectTrustedChiefVersion(response(build()), sha)).toBe(validVersion);
    expect(() => selectTrustedChiefVersion(response(build({ app: { id: 2 } })), sha)).toThrow();
    expect(() => selectTrustedChiefVersion(response(build({ head_sha: otherSha })), sha)).toThrow();
    expect(() => selectTrustedChiefVersion(response(build({ conclusion: 'failure' })), sha)).toThrow();
  });

  it('rejects malformed, absent, duplicated or conflicting version IDs', () => {
    for (const summary of [
      `Preview URL: ${validUrl}`,
      `Version ID: 1234abcd-0000\\nPreview URL: ${validUrl}`,
      `Version ID: ${validVersion}\\nVersion ID: ${validVersion}\\nPreview URL: ${validUrl}`,
      `Version ID: 87654321-e89b-12d3-a456-426614174000\\nPreview URL: ${validUrl}`,
    ]) {
      expect(() => selectTrustedChiefVersion(response(build({ output: { summary } })), sha)).toThrow();
    }
    const different = '1234abcd-0000-4000-8000-000000000000';
    expect(() => selectTrustedChiefVersion(response(
      build(),
      build({ output: { summary: `Version ID: ${different}\\nPreview URL: ${validUrl}` } }),
    ), sha)).toThrow();
  });

  it('accepts a single authenticated exact-head Cloudflare preview', () => {
    expect(selectTrustedChiefPreview(response(build()), sha)).toBe(validUrl);
  });
  it('rejects a forged check name, wrong publisher, wrong or malformed SHA', () => {
    expect(() => selectTrustedChiefPreview(response(build({ name: 'Cloudflare build' })), sha)).toThrow();
    expect(() => selectTrustedChiefPreview(response(build({ app: { id: 3 } })), sha)).toThrow();
    expect(() => selectTrustedChiefPreview(response(build({ head_sha: otherSha })), sha)).toThrow();
    expect(() => selectTrustedChiefPreview(response(build()), 'a')).toThrow();
  });
  it('rejects incomplete or unsuccessful provider checks', () => {
    expect(() => selectTrustedChiefPreview(response(build({ status: 'queued' })), sha)).toThrow();
    expect(() => selectTrustedChiefPreview(response(build({ conclusion: 'failure' })), sha)).toThrow();
    expect(() => selectTrustedChiefPreview({ check_runs: [] }, sha)).toThrow();
  });
  it('rejects off-domain destinations before privileged credentials are sent', () => {
    for (const destination of [
      'https://attacker.example/receive',
      'https://1234abcd-chief-ai.mcgill-raylene.workers.dev.attacker.example',
      'http://1234abcd-chief-ai.mcgill-raylene.workers.dev',
      'https://evil@1234abcd-chief-ai.mcgill-raylene.workers.dev',
      'https://1234abcd-chief-ai.mcgill-raylene.workers.dev:8443',
      'https://1234abcd-chief-ai.mcgill-raylene.workers.dev/redirect',
      'https://1234abcd-chief-ai.mcgill-raylene.workers.dev/?next=evil',
      'https://1234abcd-chief-ai.mcgill-raylene.workers.dev/#fragment',
    ]) {
      expect(() => selectTrustedChiefPreview(response(build({
        output: { summary: `Preview URL: ${destination}` },
      })), sha), destination).toThrow();
    }
  });
  it('rejects malformed summaries and multiple preview values', () => {
    expect(() => selectTrustedChiefPreview(response(build({ output: null })), sha)).toThrow();
    expect(() => selectTrustedChiefPreview(response(build({ output: { summary: 'No preview here' } })), sha)).toThrow();
    expect(() => selectTrustedChiefPreview(response(build({
      output: { summary: `Preview URL: ${validUrl}\nPreview URL: https://5678abcd-chief-ai.mcgill-raylene.workers.dev` },
    })), sha)).toThrow();
  });
  it('rejects multiple successful provider checks with disagreeing origins', () => {
    expect(() => selectTrustedChiefPreview(response(
      build(), build({ output: { summary: 'Preview URL: https://5678abcd-chief-ai.mcgill-raylene.workers.dev' } }),
    ), sha)).toThrow();
  });
  it('ignores unrelated checks and returns a canonical origin', () => {
    expect(selectTrustedChiefPreview(response(
      build({ head_sha: otherSha }),
      build({ app: { id: 101 } }),
      build({ output: { summary: `Preview URL: ${validUrl}/` } }),
    ), sha)).toBe(validUrl);
  });
});
