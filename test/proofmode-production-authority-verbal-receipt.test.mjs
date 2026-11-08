// stdlib-only: runs with `node --test` (no npm install required).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  loadAuthoritySnapshot,
  validateAuthority,
} from '../scripts/proofmode-production-authority.mjs';

const sha = 'a'.repeat(40);
const baseEnv = {
  EXPECTED_HEAD_SHA: sha,
  REPOSITORY_OWNER: 'jussray',
  GITHUB_ACTOR: 'jussray',
  TRIGGERING_ACTOR: 'jussray',
  GITHUB_RUN_ATTEMPT: '1',
  AUTHORIZE_PRODUCTION: 'true',
  AUTHORITY_PR: '145',
  AUTHORITY_RECEIPT: 'founder-verbal-authorization',
  ACTIVATION_RUN_ID: '',
  GITHUB_REPOSITORY: 'jussray/chief-ai-machine',
  GH_TOKEN: 'test-token',
};
const pr = {
  number: 145,
  state: 'open',
  user: { login: 'jussray' },
  head: { sha, repo: { full_name: 'jussray/chief-ai-machine' } },
};

function fakeFetch(calls) {
  return async (url) => {
    calls.push(url);
    const body = url.endsWith('/pulls/145') ? pr : [];
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

test('verbal sentinel loads without a review-by-id fetch', async () => {
  const calls = [];
  const snapshot = await loadAuthoritySnapshot(baseEnv, fakeFetch(calls));
  assert.equal(calls.some((url) => url.includes('/reviews/')), false);
  assert.equal(snapshot.review, null);
  assert.equal(snapshot.pr.number, 145);
});

test('direct founder with verbal sentinel validates end to end', async () => {
  const result = await validateAuthority(baseEnv, fakeFetch([]));
  assert.equal(result, true);
});

test('verbal sentinel rejects a non-founder executor', async () => {
  const env = { ...baseEnv, GITHUB_ACTOR: 'someone-else', TRIGGERING_ACTOR: 'someone-else' };
  await assert.rejects(validateAuthority(env, fakeFetch([])), /founder/);
});

test('non-sentinel receipts must still be positive integers (fail closed)', async () => {
  const env = { ...baseEnv, AUTHORITY_RECEIPT: 'founder-something-else' };
  await assert.rejects(loadAuthoritySnapshot(env, fakeFetch([])), /positive integer/);
});

test('protected workflow no longer skips validation for the verbal receipt', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url),
    'utf8',
  );
  assert.equal(workflow.includes('"$AUTHORITY_RECEIPT" != "founder-verbal-authorization"'), false);
  assert.equal(workflow.includes('node scripts/proofmode-production-authority.mjs validate'), true);
});
