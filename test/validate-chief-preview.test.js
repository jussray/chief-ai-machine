import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { selectTrustedChiefPreview } from '../scripts/validate-chief-preview.mjs';

const sha = 'a'.repeat(40);
const otherSha = 'b'.repeat(40);
const appId = 85455;
const validUrl = 'https://1234abcd-chief-ai.mcgill-raylene.workers.dev';
const build = (patch = {}) => ({
  name: 'Workers Builds: chief-ai',
  head_sha: sha,
  app: { id: appId },
  status: 'completed',
  conclusion: 'success',
  output: { summary: `Version ID: 123e4567-e89b-12d3-a456-426614174000\nPreview URL: ${validUrl}\n` },
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
