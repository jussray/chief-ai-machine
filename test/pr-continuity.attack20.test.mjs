import test from 'node:test';
import assert from 'node:assert/strict';
import {
  START_MARKER,
  END_MARKER,
  SCHEMA,
  isCurrentCompareStatus,
  classifyCompareStatus,
  assertExpectedHead,
  replaceManagedBlock,
  continuityBlock,
  collectRolloverOrder,
  sameRepositoryPull,
} from '../scripts/pr-continuity.mjs';

const repo = 'jussray/example';
const baseRepo = { full_name: repo };

function pr(number, baseRef, headRef, state = 'open', headRepo = baseRepo) {
  return { number, state, base: { ref: baseRef, repo: baseRepo }, head: { ref: headRef, repo: headRepo } };
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
  assert.match(next, /^Human scope/);
  assert.match(next, /receipt/);
});
test('AT11 refresh managed block preserves surrounding prose', () => {
  const body = `Before\n\n${START_MARKER}\nold\n${END_MARKER}\n\nAfter`;
  const next = replaceManagedBlock(body, `${START_MARKER}\nnew\n${END_MARKER}`);
  assert.match(next, /^Before/);
  assert.match(next, /new/);
  assert.doesNotMatch(next, /old/);
  assert.match(next, /After$/);
});
test('AT12 duplicate markers block metadata mutation', () => assert.throws(() => replaceManagedBlock(`${START_MARKER}${START_MARKER}${END_MARKER}`, 'x'), /MALFORMED/));
test('AT13 orphan start marker blocks', () => assert.throws(() => replaceManagedBlock(`${START_MARKER}x`, 'x'), /MALFORMED/));
test('AT14 orphan end marker blocks', () => assert.throws(() => replaceManagedBlock(`x${END_MARKER}`, 'x'), /MALFORMED/));
test('AT15 proof subject equals live head', () => {
  const block = continuityBlock({ repository: repo, prNumber: 7, rootBaseRef: 'main', rootBaseSha: '1'.repeat(40), baseRef: 'main', baseSha: '1'.repeat(40), headRef: 'feature', headSha: '2'.repeat(40), continuityState: 'CURRENT', proofState: 'EXACT_HEAD_PROOF_SEPARATE' });
  assert.ok(block.includes(`proof_subject: \`${'2'.repeat(40)}\``));
});
test('AT16 receipt explicitly denies merge authority', () => assert.match(continuityBlock({ repository: repo, prNumber: 1, rootBaseRef: 'main', rootBaseSha: '1', baseRef: 'main', baseSha: '1', headRef: 'x', headSha: '2', continuityState: 'CURRENT', proofState: 'SEPARATE' }), /merge_authority: \*\*false\*\*/));
test('AT17 receipt explicitly denies deploy authority', () => assert.match(continuityBlock({ repository: repo, prNumber: 1, rootBaseRef: 'main', rootBaseSha: '1', baseRef: 'main', baseSha: '1', headRef: 'x', headSha: '2', continuityState: 'CURRENT', proofState: 'SEPARATE' }), /deploy_authority: \*\*false\*\*/));
test('AT18 stacked dependency graph rolls parent before child', () => assert.deepEqual(collectRolloverOrder([pr(10, 'main', 'parent'), pr(11, 'parent', 'child')]), [10, 11]));
test('AT19 unrelated stack is excluded', () => assert.deepEqual(collectRolloverOrder([pr(10, 'other', 'child')]), []));
test('AT20 cyclic malformed stack terminates once per pull', () => assert.deepEqual(collectRolloverOrder([pr(1, 'main', 'a'), pr(2, 'a', 'main')]), [1, 2]));
test('schema remains stable', () => assert.equal(SCHEMA, 'juss/pr-continuity@v1'));
