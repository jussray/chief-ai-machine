import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRun, parseRunUrl, reconcileNotices } from '../scripts/triage.mjs';

const sha = 'a'.repeat(40);
const newer = 'b'.repeat(40);
const repo = 'jussray/chief-ai-machine';
const runUrl = 'https://github.com/jussray/chief-ai-machine/actions/runs/41156805451?email_source=notifications';

describe('actions-mail audit read-only input and exact-head contract', () => {
  it('only accepts GitHub Actions run URLs within the current repo', () => {
    assert.equal(parseRunUrl(runUrl, repo)?.runId, '41156805451');
    assert.equal(parseRunUrl('https://evil.example/path', repo), null);
    assert.equal(parseRunUrl('https://github.com/jussray/StoryEngine/actions/runs/100', repo), null);
    assert.equal(parseRunUrl('https://github.com.evil.example/jussray/chief-ai-machine/actions/runs/100', repo), null);
  });
  it('marks an older failing run stale, not resolved', () => {
    assert.equal(classifyRun({ head_sha: sha, status: 'completed', conclusion: 'failure' }, newer), 'STALE_HEAD_NOT_PROVEN_FIXED');
  });
  it('distinguishes a failed current head from a green single run', () => {
    assert.equal(classifyRun({ head_sha: sha, status: 'completed', conclusion: 'failure' }, sha), 'CURRENT_RED');
    assert.equal(classifyRun({ head_sha: sha, status: 'completed', conclusion: 'success' }, sha), 'CURRENT_RUN_GREEN_ONLY');
  });
  it('deduplicates Gmail alerts and gets live branch readback', async () => {
    let reads = 0;
    const notices = [1, 2].map(x => ({ message_id: String(x), mailbox: 'alerts@example.test', labels: ['INBOX'], run_url: runUrl }));
    const out = await reconcileNotices(notices, { repo, readRun: async () => { reads++; return { head_branch: 'main', head_sha: sha, status: 'completed', conclusion: 'failure' }; }, readBranch: async () => sha });
    assert.equal(out.length, 1);
    assert.equal(reads, 1);
    assert.equal(out[0].status, 'CURRENT_RED');
    assert.equal(out[0].event_fingerprint.length, 64);
    assert.equal(JSON.stringify(out).includes('Bearer'), false);
  });
  it('holds potential credential reports even if the Actions run succeeded', async () => {
    const out = await reconcileNotices([{ kind: 'security', message_id: 'security-1', run_url: runUrl }], { repo, readRun: async () => ({ head_branch: 'main', head_sha: sha, status: 'completed', conclusion: 'success' }), readBranch: async () => sha });
    assert.equal(out[0].status, 'SECURITY_TRIAGE_UNVERIFIED');
  });
  it('rejects unredacted mail content rather than silently discarding it', async () => {
    await assert.rejects(reconcileNotices([{ message_id: 'm1', body: 'not allowed in runtime', run_url: runUrl }], { repo, readRun: async () => ({ head_branch: 'main', head_sha: sha, status: 'completed', conclusion: 'failure' }), readBranch: async () => sha }), /disallowed fields/);
  });
  it('does not turn unavailable GitHub access into success', async () => {
    const out = await reconcileNotices([{ message_id: 'm1', run_url: runUrl }], { repo, readRun: async () => { throw new Error('no access'); }, readBranch: async () => sha });
    assert.equal(out[0].status, 'COVERAGE_BLOCKED');
  });
});
