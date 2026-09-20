import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  START_MARKER,
  END_MARKER,
  SCHEMA,
  CONTINUITY_GATE_NAME,
  isCurrentCompareStatus,
  classifyCompareStatus,
  assertExpectedHead,
  replaceManagedBlock,
  continuityBlock,
  collectRolloverOrder,
  sameRepositoryPull,
  samePullSnapshot,
} from '../scripts/pr-continuity.mjs';

const repo = 'jussray/example';
const baseRepo = { full_name: repo };
const clone = (value) => JSON.parse(JSON.stringify(value));
function pr(number, baseRef, headRef, state = 'open', headRepo = baseRepo, body = '') {
  return { number, state, body, base: { ref: baseRef, repo: baseRepo }, head: { ref: headRef, sha: String(number).padStart(40, '0'), repo: headRepo } };
}

test('AT01 identical base/head is current ancestry', () => assert.equal(isCurrentCompareStatus('identical'), true));
test('AT02 ahead head is current ancestry', () => assert.equal(isCurrentCompareStatus('ahead'), true));
test('AT03 behind head fails stale', () => assert.equal(classifyCompareStatus('behind'), 'STALE_BASE'));
test('AT04 diverged head fails stale', () => assert.equal(classifyCompareStatus('diverged'), 'STALE_BASE'));
test('AT05 unknown compare status blocks', () => assert.equal(classifyCompareStatus('mystery'), 'BLOCKED_UNKNOWN_COMPARE'));
test('AT06 expected head mismatch fails', () => assert.throws(() => assertExpectedHead('a'.repeat(40), 'b'.repeat(40)), /HEAD_MOVED/));
test('AT07 exact head match passes', () => assert.equal(assertExpectedHead('a'.repeat(40), 'a'.repeat(40)), true));
test('AT08 fork pull is not same-repository authority', () => assert.equal(sameRepositoryPull(pr(1, 'main', 'fork', 'open', { full_name: 'other/repo' }), repo), false));
test('AT09 same-repo pull qualifies', () => assert.equal(sameRepositoryPull(pr(1, 'main', 'feature'), repo), true));
test('AT10 append managed block preserves body', () => {
  const next = replaceManagedBlock('Human scope', `${START_MARKER}\nreceipt\n${END_MARKER}`);
  assert.ok(next.startsWith('Human scope'));
  assert.match(next, /receipt/);
});
test('AT11 refresh managed block preserves surrounding prose', () => {
  const body = `Before\n\n${START_MARKER}\nold\n${END_MARKER}\n\nAfter`;
  const next = replaceManagedBlock(body, `${START_MARKER}\nnew\n${END_MARKER}`);
  assert.ok(next.startsWith('Before'));
  assert.match(next, /new/);
  assert.doesNotMatch(next, /old/);
  assert.ok(next.endsWith('After'));
});
test('AT12 duplicate markers block metadata mutation', () => assert.throws(() => replaceManagedBlock(`${START_MARKER}${START_MARKER}${END_MARKER}`, 'x'), /MALFORMED/));
test('AT13 orphan start marker blocks', () => assert.throws(() => replaceManagedBlock(`${START_MARKER}x`, 'x'), /MALFORMED/));
test('AT14 orphan end marker blocks', () => assert.throws(() => replaceManagedBlock(`x${END_MARKER}`, 'x'), /MALFORMED/));
test('AT15 proof subject equals live head', () => {
  const block = continuityBlock({ repository: repo, prNumber: 7, rootBaseRef: 'main', rootBaseSha: '1'.repeat(40), baseRef: 'main', baseSha: '1'.repeat(40), headRef: 'feature', headSha: '2'.repeat(40), continuityState: 'CURRENT', proofState: 'EXACT_HEAD_PROOF_SEPARATE' });
  assert.ok(block.includes('proof_subject: `' + '2'.repeat(40) + '`'));
});
test('AT16 receipt explicitly denies merge authority', () => assert.match(continuityBlock({ repository: repo, prNumber: 1, rootBaseRef: 'main', rootBaseSha: '1', baseRef: 'main', baseSha: '1', headRef: 'x', headSha: '2', continuityState: 'CURRENT', proofState: 'SEPARATE' }), /merge_authority: \*\*false\*\*/));
test('AT17 receipt explicitly denies deploy authority', () => assert.match(continuityBlock({ repository: repo, prNumber: 1, rootBaseRef: 'main', rootBaseSha: '1', baseRef: 'main', baseSha: '1', headRef: 'x', headSha: '2', continuityState: 'CURRENT', proofState: 'SEPARATE' }), /deploy_authority: \*\*false\*\*/));
test('AT18 stacked dependency graph rolls parent before child', () => assert.deepEqual(collectRolloverOrder([pr(10, 'main', 'parent'), pr(11, 'parent', 'child')], 'main', repo), [10, 11]));
test('AT19 unrelated stack is excluded', () => assert.deepEqual(collectRolloverOrder([pr(10, 'other', 'child')], 'main', repo), []));
test('AT20 cyclic malformed stack terminates once per pull', () => assert.deepEqual(collectRolloverOrder([pr(1, 'main', 'a'), pr(2, 'a', 'main')], 'main', repo), [1, 2]));
test('AT21 fork head names cannot authorize traversal into a local stack', () => {
  const fork = pr(1, 'main', 'shared-name', 'open', { full_name: 'fork/repo' });
  const localChild = pr(2, 'shared-name', 'local-child');
  assert.deepEqual(collectRolloverOrder([fork, localChild], 'main', repo), []);
});
test('AT22 metadata snapshots fail closed on concurrent body or head movement', () => {
  const first = pr(3, 'main', 'feature', 'open', baseRepo, 'first');
  const same = clone(first);
  const bodyMoved = { ...clone(first), body: 'changed' };
  const headMoved = clone(first);
  headMoved.head.sha = 'f'.repeat(40);
  assert.equal(samePullSnapshot(first, same), true);
  assert.equal(samePullSnapshot(first, bodyMoved), false);
  assert.equal(samePullSnapshot(first, headMoved), false);
});
test('AT23 blocked rollover publishes the exact authoritative gate name', () => assert.equal(CONTINUITY_GATE_NAME, 'PR Continuity Exact-Head Gate'));
test('AT24 workflows separate candidate, trusted, and rollover authority without event-skipped jobs', () => {
  const candidate = readFileSync('.github/workflows/pr-continuity.yml', 'utf8');
  const trusted = readFileSync('.github/workflows/pr-continuity-trusted.yml', 'utf8');
  const rollover = readFileSync('.github/workflows/pr-continuity-rollover.yml', 'utf8');

  assert.match(candidate, /\n {2}pull_request:\n/);
  assert.match(candidate, /name: PR Continuity Candidate Observation/);
  assert.doesNotMatch(candidate, /pull_request_target:/);
  assert.doesNotMatch(candidate, /github\.event_name/);
  assert.doesNotMatch(candidate, /checks: write/);
  assert.doesNotMatch(candidate, /pull-requests: write/);
  assert.doesNotMatch(candidate, /contents: write/);

  assert.match(trusted, /pull_request_target:/);
  assert.match(trusted, /branches: \[main\]/);
  assert.match(trusted, /name: Publish trusted PR continuity exact-head gate/);
  assert.match(trusted, /name: PR Continuity Metadata Receipt/);
  assert.match(trusted, /checks: write/);
  assert.match(trusted, /ref: \$\{\{ github\.sha \}\}/);
  assert.doesNotMatch(trusted, /github\.event_name/);

  assert.match(rollover, /\n {2}push:\n/);
  assert.match(rollover, /workflow_dispatch:/);
  assert.match(rollover, /name: Roll Current Main Through Open PR Graph/);
  assert.match(rollover, /PR_CONTINUITY_TOKEN: \$\{\{ secrets\.PR_CONTINUITY_TOKEN \}\}/);
  assert.doesNotMatch(rollover, /GITHUB_TOKEN: \$\{\{ github\.token \}\}/);
  assert.doesNotMatch(rollover, /github\.event_name/);
});
test('AT25 managed receipt replacement preserves surrounding whitespace byte-for-byte', () => {
  const before = 'Human prose  \n    indented-before\n';
  const after = '\n    indented-after  \nTail\t\n';
  const body = `${before}${START_MARKER}\nold\n${END_MARKER}${after}`;
  const block = `${START_MARKER}\nnew\n${END_MARKER}`;
  const next = replaceManagedBlock(body, block);
  assert.equal(next, `${before}${block}${after}`);
});
test('AT26 rollover requires a workflow-triggering credential and post-move reverify evidence', () => {
  const rollover = readFileSync('.github/workflows/pr-continuity-rollover.yml', 'utf8');
  const engine = readFileSync('scripts/pr-continuity.mjs', 'utf8');
  assert.match(rollover, /workflow-triggering continuity credential/);
  assert.match(engine, /waitForReverification/);
  assert.match(engine, /BLOCKED_REVERIFY_TRIGGER/);
});
test('AT27 update-branch provider errors become blocked exact-head results instead of escaping rollover', () => {
  const engine = readFileSync('scripts/pr-continuity.mjs', 'utf8');
  assert.match(engine, /allow: \[202, 403, 409, 422, 500, 502, 503, 504\]/);
  assert.match(engine, /catch \(error\) \{\s*return providerUpdateBlockedResult/);
  assert.match(engine, /state: 'BLOCKED_PROVIDER_UPDATE'/);
  assert.match(engine, /for \(const result of blocked\) await publishHeadFailure\(repo, result\)/);
});
test('schema remains stable', () => assert.equal(SCHEMA, 'juss/pr-continuity@v1'));