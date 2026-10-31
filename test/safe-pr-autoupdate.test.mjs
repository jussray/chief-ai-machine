import { test } from 'vitest';
import { URL } from 'node:url';
import process from 'node:process';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decision } from '../scripts/safe-pr-autoupdate.mjs';

const repo = process.env.GITHUB_REPOSITORY || 'jussray/promptos';
const candidate = (overrides = {}) => ({
  state: 'open',
  user: { login: 'jussray' },
  base: { ref: 'main', sha: 'a'.repeat(40) },
  head: { sha: 'b'.repeat(40), repo: { full_name: repo } },
  labels: [{ name: 'juss-auto-update' }],
  auto_merge: null,
  draft: true,
  ...overrides,
});

test('only opted-in same-repo founder PRs qualify for branch ancestry inspection', () => {
  assert.equal(decision(candidate(), repo), 'CHECK_ANCESTRY');
  assert.equal(decision(candidate({ labels: [] }), repo), 'NOT_OPTED_IN');
  assert.equal(decision(candidate({ user: { login: 'untrusted' } }), repo), 'NON_FOUNDER_AUTHOR');
  assert.equal(decision(candidate({ base: { ref: 'production' } }), repo), 'NON_MAIN_BASE');
  assert.equal(decision(candidate({ head: { sha: 'b'.repeat(40), repo: { full_name: 'outside/fork' } } }), repo), 'EXTERNAL_HEAD');
  assert.equal(decision(candidate({ state: 'closed' }), repo), 'NOT_OPEN');
});

test('auto-merge authorization and stale head inputs are never reused', () => {
  assert.equal(decision(candidate({ auto_merge: { enabled_by: { login: 'jussray' } } }), repo), 'AUTO_MERGE_ARMED_REAPPROVAL_REQUIRED');
  assert.equal(decision(candidate({ head: { sha: 'not-a-sha', repo: { full_name: repo } } }), repo), 'INVALID_HEAD');
});

test('workflow runs only on trusted main, bounded schedule, and explicit manual approval', () => {
  const workflow = readFileSync(new URL('../.github/workflows/founder-safe-pr-refresh.yml', import.meta.url), 'utf8');
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /schedule:/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /node scripts\/safe-pr-autoupdate\.mjs --run/);
  assert.match(workflow, /github\.token/);
  assert.doesNotMatch(workflow, /pull_request_target:/);
  assert.doesNotMatch(workflow, /secrets\./);
});

test('API compare-and-set, fail-closed repair, and exact-head auto-merge are visible in source', () => {
  const script = readFileSync(new URL('../scripts/safe-pr-autoupdate.mjs', import.meta.url), 'utf8');
  assert.match(script, /expected_head_sha: fresh\.head\.sha/);
  assert.match(script, /MAX_UPDATES = 5/);
  assert.match(script, /ARM_EXACT_AUTO_MERGE/);
  assert.match(script, /--match-head-commit/);
  assert.match(script, /AUTO_MERGE_ARMED_REAPPROVAL_REQUIRED/);
  assert.match(script, /Agent Merge/);
  assert.doesNotMatch(script, /--admin|force:\s*true|deleteBranch:\s*true/);
});
