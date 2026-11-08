import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { discoverTrustedChiefPreview, validatePreviewOrigin } from '../scripts/chief-trusted-preview-admission.mjs';

const trustedSha = 'a'.repeat(40);
const candidateSha = 'b'.repeat(40);
const preview = 'https://1234abcd-chief-ai.mcgill-raylene.workers.dev';
const env = {
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: trustedSha,
  EXPECTED_HEAD_SHA: candidateSha,
  AUTHORITY_PR: '281',
  AUTHORIZE_PROOF: 'true',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_ACTOR: 'jussray',
  TRIGGERING_ACTOR: 'jussray',
  REPOSITORY_OWNER: 'jussray',
  GITHUB_REPOSITORY: 'jussray/chief-ai-machine',
  GH_TOKEN: 'test-github-token',
};

function fixture({ movedMain = false, wrongHead = false, wrongProvider = false, maliciousPreview = false } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    let payload;
    if (url.endsWith('/branches/main')) payload = { commit: { sha: movedMain ? 'c'.repeat(40) : trustedSha } };
    else if (url.endsWith('/pulls/281')) payload = {
      number: 281, state: 'open',
      base: { ref: 'main', repo: { full_name: 'jussray/chief-ai-machine' } },
      head: { sha: wrongHead ? 'd'.repeat(40) : candidateSha, repo: { full_name: 'jussray/chief-ai-machine' } },
    };
    else if (url.includes('/check-runs?')) payload = {
      check_runs: [{
        name: 'Workers Builds: chief-ai',
        app: { id: wrongProvider ? 123 : 85455 },
        head_sha: candidateSha,
        status: 'completed', conclusion: 'success',
        output: { summary: 'Build ID: 123\nPreview URL: ' +
          (maliciousPreview ? 'https://evil.example.com' : preview) + '\n' },
      }],
    };
    else throw new Error('Unexpected URL ' + url);
    return { ok: true, status: 200, json: async () => payload };
  };
  return { calls, fetchImpl };
}

describe('Chief trusted-only authenticated preview admission', () => {
  it('admits only an exact PR SHA with successful Cloudflare provider evidence', async () => {
    const f = fixture();
    await expect(discoverTrustedChiefPreview(env, f.fetchImpl)).resolves.toEqual({
      previewOrigin: preview, trustedMain: trustedSha, expectedHead: candidateSha,
    });
    expect(f.calls).toHaveLength(3);
  });

  it('rejects untrusted triggers before any GitHub calls', async () => {
    for (const override of [
      { GITHUB_EVENT_NAME: 'pull_request_target' },
      { GITHUB_REF: 'refs/heads/feature' },
      { GITHUB_ACTOR: 'chatgpt-codex-connector[bot]' },
      { TRIGGERING_ACTOR: 'another-actor' },
      { AUTHORIZE_PROOF: 'false' },
      { GITHUB_RUN_ATTEMPT: '2' },
      { EXPECTED_HEAD_SHA: 'invalid' },
    ]) {
      const f = fixture();
      await expect(discoverTrustedChiefPreview({ ...env, ...override }, f.fetchImpl)).rejects.toThrow();
      expect(f.calls).toHaveLength(0);
    }
  });

  it('refuses moved main, moved PR head, wrong provider app and non-immutable URLs', async () => {
    for (const config of [
      { movedMain: true }, { wrongHead: true }, { wrongProvider: true },
      { maliciousPreview: true },
    ]) {
      const f = fixture(config);
      await expect(discoverTrustedChiefPreview(env, f.fetchImpl)).rejects.toThrow();
    }
    expect(() => validatePreviewOrigin('https://1234abcd-chief-ai.mcgill-raylene.workers.dev.evil.com')).toThrow();
    expect(() => validatePreviewOrigin('https://1234abcd-chief-ai.mcgill-raylene.workers.dev/?token=secret')).toThrow();
  });

  it('never exposes secrets to candidate code or across browser redirect hosts', () => {
    const workflow = readFileSync(new URL('../.github/workflows/chief-immutable-preview-auth-proof.yml', import.meta.url), 'utf8');
    const browser = readFileSync(new URL('../scripts/chief-trusted-preview-browser.pw.mjs', import.meta.url), 'utf8');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request_target:');
    expect(workflow).not.toContain('  pull_request:');
    expect(workflow).toContain('environment: proofmode-access-admin');
    expect(workflow).toContain('ref: \${{ github.sha }}');
    expect(workflow).toContain('node scripts/chief-trusted-preview-admission.mjs');
    expect(workflow).toContain('CLOUDFLARE_ACCESS_CLIENT_ID: \${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}');
    expect(workflow).toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET: \${{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}');
    const proofStep = workflow.split('      - name: Prove exact SHA, rendered app and stylesheet with bounded service auth')[1];
    expect(proofStep).toContain('secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(workflow.split('      - name: Prove exact SHA, rendered app and stylesheet with bounded service auth')[0])
      .not.toContain('secrets.CLOUDFLARE_ACCESS_CLIENT_');
    expect(browser).toContain('if (u.origin !== origin)');
    expect(browser).toContain('await route.abort()');
    expect(browser).toContain('maxRedirects: 0');
    expect(browser).toContain("expect(payload?.sha).toBe(expectedSha)");
    expect(workflow).toContain("trace: 'off', screenshot: 'off', video: 'off'");
    expect(workflow).not.toContain('ref: \${{ inputs.expected_head_sha }}');
  });
});
