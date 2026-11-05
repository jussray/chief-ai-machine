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
