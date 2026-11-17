import { test } from 'vitest';
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

test('verbal founder authorization skips review lookup but still loads current PR and consumption comments', async () => {
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.includes('/pulls/145')) {
      return new Response(JSON.stringify(pr), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (url.includes('/issues/145/comments')) {
      return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
  const loaded = await loadAuthoritySnapshot(env, fakeFetch);
  assert.equal(loaded.review, null);
  assert.equal(loaded.pr.head.sha, sha);
  assert.equal(calls.some((url) => url.includes('/reviews/')), false);
});

test('direct founder verbal authorization is accepted only at the exact current head', () => {
  assert.equal(assertAuthoritySnapshot(snapshot), true);
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

test('only four authenticated proof steps receive the Access secret pair', () => {
  const yaml = readFileSync(new URL('../.github/workflows/proofmode-production-playwright.yml', import.meta.url), 'utf8');
  const allowed = {
    'protected-access': [
      'Verify protected preview serves exact head',
      'Run protected ProofMode MCP Playwright proof',
    ],
    verify: [
      'Wait for production runtime to serve exact head',
      'Run production ProofMode MCP Playwright proof',
    ],
  };
  for (const [jobName, allowedNames] of Object.entries(allowed)) {
    const job = yaml.split('  ' + jobName + ':')[1]?.split(/\n {2}(?:verify|finalize-authority):/)[0];
    assert.ok(job, 'Missing ' + jobName + ' job');
    assert.doesNotMatch(job.split('    steps:')[0], /secrets\.CLOUDFLARE_ACCESS_CLIENT_/);
    const steps = job.split(/\n {6}- name: /).slice(1);
    const authorized = steps.filter((section) =>
      section.includes('CLOUDFLARE_ACCESS_CLIENT_ID: $' + '{{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}'),
    );
    assert.deepEqual(authorized.map((section) => section.split('\n')[0].trim()), allowedNames);
    for (const section of authorized) {
      assert.ok(section.includes('CLOUDFLARE_ACCESS_CLIENT_SECRET: $' + '{{ secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET }}'));
    }
  }
});
