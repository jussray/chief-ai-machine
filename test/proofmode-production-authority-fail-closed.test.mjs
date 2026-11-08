import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertAuthoritySnapshot, loadAuthoritySnapshot } from '../scripts/proofmode-production-authority.mjs';

const sha = 'a'.repeat(40);
const env = {
  EXPECTED_HEAD_SHA: sha, REPOSITORY_OWNER: 'jussray',
  GITHUB_ACTOR: 'jussray', TRIGGERING_ACTOR: 'jussray',
  GITHUB_RUN_ATTEMPT: '1', AUTHORIZE_PRODUCTION: 'true',
  AUTHORITY_PR: '145', AUTHORITY_RECEIPT: 'founder-verbal-authorization',
  GITHUB_REPOSITORY: 'jussray/chief-ai-machine', GH_TOKEN: 'test-token',
};
const pr = { number: 145, state: 'open', user: { login: 'jussray' },
  head: { sha, repo: { full_name: 'jussray/chief-ai-machine' } } };
const snapshot = { pr, review: null, comments: [], env };

test('verbal sentinel fails closed before remote API requests', async () => {
  let calls = 0;
  await assert.rejects(loadAuthoritySnapshot(env, async () => { calls++; }), /positive integer/);
  assert.equal(calls, 0);
});
test('verbal sentinel cannot bypass snapshot authorization', () => {
  assert.throws(() => assertAuthoritySnapshot(snapshot), /positive integer/);
});
test('wrong actor fails closed', () => {
  assert.throws(() => assertAuthoritySnapshot({
    ...snapshot, env: { ...env, GITHUB_ACTOR: 'other' },
  }), /authenticated/);
});
test('rerun fails closed', () => {
  assert.throws(() => assertAuthoritySnapshot({
    ...snapshot, env: { ...env, GITHUB_RUN_ATTEMPT: '2' },
  }), /reruns/);
});
test('authorization flag is mandatory', () => {
  assert.throws(() => assertAuthoritySnapshot({
    ...snapshot, env: { ...env, AUTHORIZE_PRODUCTION: 'false' },
  }), /authorization flag/);
});
test('wrong head fails closed', () => {
  assert.throws(() => assertAuthoritySnapshot({
    ...snapshot, env: { ...env, EXPECTED_HEAD_SHA: 'b'.repeat(40) },
  }), /head moved/);
});
test('protected access always validates and does not expose secrets at job scope', () => {
  const yaml = readFileSync(new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url), 'utf8');
  const job = yaml.split('  protected-access:')[1].split('  verify:')[0];
  const jobEnv = job.split('    steps:')[0];
  assert.doesNotMatch(jobEnv, /secrets\.CLOUDFLARE_ACCESS_CLIENT_/);
  assert.match(job, /node scripts\/proofmode-production-authority\.mjs validate/);
  assert.doesNotMatch(job, /AUTHORITY_RECEIPT" !=/);
});
