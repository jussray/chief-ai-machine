import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { publishTrustedChiefPreviewReceipt, TRUSTED_PROOF_NAME } from '../scripts/chief-trusted-preview-publish.mjs';

const mainSha = 'a'.repeat(40);
const headSha = 'b'.repeat(40);
const repo = 'jussray/chief-ai-machine';
const env = {
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_SHA: mainSha,
  EXPECTED_HEAD_SHA: headSha,
  AUTHORITY_PR: '281',
  AUTHORIZE_PROOF: 'true',
  GITHUB_RUN_ATTEMPT: '1',
  GITHUB_RUN_ID: '49001234567',
  GITHUB_ACTOR: 'jussray',
  TRIGGERING_ACTOR: 'jussray',
  REPOSITORY_OWNER: 'jussray',
  GITHUB_REPOSITORY: repo,
  GH_TOKEN: 'test-github-token',
  PROOF_RESULT: 'success',
};

function fixture({ changedHead = false, rejectWrite = false } = {}) {
  const writes = [];
  const fetchImpl = async (url, init = {}) => {
    if (init.method === 'POST') {
      writes.push({ url, body: JSON.parse(init.body) });
      return {
        ok: !rejectWrite,
        status: rejectWrite ? 403 : 201,
        json: async () => ({
          id: 1234, name: TRUSTED_PROOF_NAME, head_sha: headSha,
          conclusion: 'success', status: 'completed',
        }),
      };
    }
    let body;
    if (url.endsWith('/branches/main')) body = { commit: { sha: mainSha } };
    else if (url.endsWith('/pulls/281')) body = {
      number: 281, state: 'open',
      base: { ref: 'main', repo: { full_name: repo } },
      head: { sha: changedHead ? 'c'.repeat(40) : headSha, repo: { full_name: repo } },
    };
    else if (url.endsWith('/commits/' + headSha + '/check-runs?per_page=100')) body = {
      check_runs: [{
        name: 'Workers Builds: chief-ai', head_sha: headSha,
        app: { id: 85455 }, status: 'completed', conclusion: 'success',
        output: { summary: '\nPreview URL: https://1234abcd-chief-ai.mcgill-raylene.workers.dev\n' },
      }],
    };
    else throw new Error('Unexpected test URL');
    return { ok: true, status: 200, json: async () => body };
  };
  return { writes, fetchImpl };
}

describe('Chief trusted authenticated preview proof receipt', () => {
  it('publishes a separate exact-head receipt only after real proof success', async () => {
    const f = fixture();
    await expect(publishTrustedChiefPreviewReceipt(env, f.fetchImpl))
      .resolves.toEqual({ expectedHead: headSha, checkId: 1234 });
    expect(f.writes).toHaveLength(1);
    expect(f.writes[0].url).toBe('https://api.github.com/repos/' + repo + '/check-runs');
    expect(f.writes[0].body).toMatchObject({
      name: TRUSTED_PROOF_NAME,
      head_sha: headSha, conclusion: 'success', status: 'completed',
      details_url: 'https://github.com/' + repo + '/actions/runs/' + env.GITHUB_RUN_ID,
    });
    expect(f.writes[0].body.output.summary).toContain('not the required runtime gate');
  });

  it('refuses unproven, rerun and nonfounder publication before POST', async () => {
    for (const override of [
      { PROOF_RESULT: 'failure' },
      { PROOF_RESULT: 'skipped' },
      { GITHUB_RUN_ATTEMPT: '2' },
      { GITHUB_ACTOR: 'github-actions[bot]' },
      { GITHUB_REF: 'refs/heads/feature' },
      { GITHUB_RUN_ID: '0' },
    ]) {
      const f = fixture();
      await expect(publishTrustedChiefPreviewReceipt({ ...env, ...override }, f.fetchImpl))
        .rejects.toThrow();
      expect(f.writes).toHaveLength(0);
    }
  });

  it('does not publish for a moved exact PR head or failed GitHub write', async () => {
    const moved = fixture({ changedHead: true });
    await expect(publishTrustedChiefPreviewReceipt(env, moved.fetchImpl)).rejects.toThrow('exact-head');
    expect(moved.writes).toHaveLength(0);
    const denied = fixture({ rejectWrite: true });
    await expect(publishTrustedChiefPreviewReceipt(env, denied.fetchImpl)).rejects.toThrow('403');
    expect(denied.writes).toHaveLength(1);
  });

  it('keeps proof publisher behind founder-only trusted main, separate from required gate', () => {
    const yaml = readFileSync(new URL('../.github/workflows/chief-immutable-preview-auth-proof.yml', import.meta.url), 'utf8');
    const publisher = yaml.split('  publish-trusted-preview-receipt:')[1] || '';
    expect(yaml).toContain('workflow_dispatch:');
    expect(yaml).not.toContain('pull_request_target:');
    expect(publisher).toContain('needs: [admission, protected-preview-proof]');
    expect(publisher).toContain('checks: write');
    expect(publisher).toContain('PROOF_RESULT:');
    expect(publisher).toContain('ref:');
    expect(publisher).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(publisher).not.toContain('CLOUDFLARE_ACCESS_CLIENT_ID');
    expect(publisher).toContain('node scripts/chief-trusted-preview-publish.mjs');
    expect(yaml).toContain('environment: proofmode-access-admin');
  });
});
