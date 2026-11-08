import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'vitest';

const workflow = readFileSync('.github/workflows/proofmode-mcp-playwright.yml', 'utf8');

test('ProofMode trusted evaluator binds diff base to the trusted main snapshot', () => {
  assert.match(workflow, /BASE_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /TRUSTED_EVALUATOR_SHA: \$\{\{ github\.sha \}\}/);
});

test('ProofMode applicability delegates shared-surface normalization to tested trusted code', () => {
  assert.match(workflow, /scripts\/proofmode-scope-normalize\.mjs wrangler/);
  assert.match(workflow, /scripts\/proofmode-scope-normalize\.mjs http-worker/);
  assert.match(workflow, /shared_changed=false/);
  assert.match(workflow, /ProofMode surfaces unchanged after removing the bounded GitHub-only route additions/);
  assert.doesNotMatch(workflow, /raw=raw\.replace/);
});

test('direct ProofMode and classifier files still force live proof', () => {
  assert.match(workflow, /worker\/proofmode-mcp\\\.js/);
  assert.match(workflow, /worker\/index\\\.js/);
  assert.match(workflow, /e2e\/proofmode-mcp\\\.pw\\\.mjs/);
  assert.match(workflow, /scripts\/proofmode-scope-normalize\\\.mjs/);
});

const materializer = readFileSync('.github/workflows/governance-required-check-materializer.yml', 'utf8');

test('provider receipt waits for the trusted exact-head Cloudflare build before fallback', () => {
  const job = materializer.split('  runtime-proof:')[0];
  const retry = job.indexOf('for attempt in {1..90}; do');
  const exact = job.indexOf('if has_provider_receipt "$EXPECTED_HEAD_SHA"; then', retry);
  const wait = job.indexOf('if [ "$attempt" -lt 90 ]; then sleep 2; fi', retry);
  const fallback = job.indexOf('inherited_sha=""', retry);
  assert.ok(retry >= 0 && exact > retry && wait > exact && fallback > wait,
    'bounded exact-head proof must precede predecessor fallback');
  assert.match(job, /x\.head_sha===expected/);
  assert.match(job, /x\.app\?\.id===Number\(process\.env\.CLOUDFLARE_CHECK_APP_ID\)/);
  assert.match(job, /x\.status==="completed"/);
  assert.match(job, /x\.conclusion==="success"/);
  assert.match(job, /Provider-affecting or unclassified files changed since the last proven receipt/);
});
