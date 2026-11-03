import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test as it } from 'node:test';
import {
  assessDefensivePromotion,
  collectFiles,
  verifyScopedWorkflow,
} from '../scripts/verify-scoped-parallel-proof-workflow.mjs';

const SHA = 'f'.repeat(40);
const valid = {
  caseId: 'cross-tenant-google-drive-blocked',
  sourceSha: SHA,
  testPath: 'src/lib/__tests__/workspaceSecurity.test.ts',
  runStatus: 'passed',
  runId: 'verified-job-123',
  scope: 'authorized-ci',
  realTestExecuted: true,
  baselineFailureObserved: true,
  outcomeReadbackObserved: true,
};

it('unverified simulations never promote automatically, even with apparently complete evidence', () => {
  const result = assessDefensivePromotion(valid, SHA);
  assert.equal(result.eligibleForIndependentReview, true);
  assert.equal(result.autoPromote, false);
});

it('forged green, absent run, unapproved scope and missing readback all fail closed', () => {
  const result = assessDefensivePromotion({
    ...valid,
    runStatus: 'success-looking',
    realTestExecuted: false,
    scope: 'external-unsanctioned',
    outcomeReadbackObserved: false,
  }, SHA);
  assert.equal(result.eligibleForIndependentReview, false);
  for (const reason of ['MISSING_PASS', 'NOT_EXECUTED', 'UNAUTHORIZED_SCOPE', 'MISSING_READBACK']) {
    assert.ok(result.reasons.includes(reason), reason);
  }
});

it('stale head and path traversal cannot be treated as a successful attack', () => {
  const result = assessDefensivePromotion({
    ...valid,
    testPath: 'tests/../../secret.test.ts',
  }, 'a'.repeat(40));
  assert.equal(result.eligibleForIndependentReview, false);
  assert.ok(result.reasons.includes('STALE_OR_INVALID_HEAD'));
  assert.ok(result.reasons.includes('INVALID_TEST_TARGET'));
});

it('an apparent pass without the original failing test remains a candidate', () => {
  const result = assessDefensivePromotion({ ...valid, baselineFailureObserved: false }, SHA);
  assert.equal(result.eligibleForIndependentReview, false);
  assert.ok(result.reasons.includes('MISSING_RED_PROOF'));
});

it('skill discovery stays within requested roots and ignores symlinked external data', async () => {
  const root = await mkdtemp(join(tmpdir(), 'juss-skill-audit-'));
  try {
    await mkdir(join(root, 'skills', 'founder-owned'), { recursive: true });
    await writeFile(join(root, 'skills', 'founder-owned', 'SKILL.md'), '# fixture\n');
    await writeFile(join(root, 'unrelated.txt'), 'do not scan');
    await symlink(join(root, 'unrelated.txt'), join(root, 'skills', 'shortcut.md'));
    const files = await collectFiles(root, ['skills']);
    assert.deepEqual(files, ['skills/founder-owned/SKILL.md']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('live repository inventory is explicitly source-only, not a claim of executed attack runs', async () => {
  const result = await verifyScopedWorkflow();
  assert.ok(result.sourceSkillDefinitions > 0);
  assert.equal(result.status, 'SOURCE_CONTRACT_ONLY');
  assert.equal(result.attackRunsExecutedByInventory, 0);
  assert.equal(result.autoPromotedSimulations, 0);
  assert.equal(result.liveProviderOutcome, 'NOT RUN');
});
