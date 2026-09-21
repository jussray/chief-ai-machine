import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

const workflow = readFileSync('.github/workflows/proofmode-mcp-playwright.yml', 'utf8');

test('ProofMode trusted evaluator binds diff base to the trusted main snapshot', () => {
  assert.match(workflow, /BASE_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /TRUSTED_EVALUATOR_SHA: \$\{\{ github\.sha \}\}/);
});

test('ProofMode applicability ignores only the bounded GitHub route additions on shared surfaces', () => {
  assert.match(workflow, /normalize_wrangler\(\)/);
  assert.match(workflow, /route!=="\/github\/\*"/);
  assert.match(workflow, /normalize_http_worker\(\)/);
  assert.match(workflow, /handleGitHubAppRequest/);
  assert.match(workflow, /shared_changed=false/);
  assert.match(workflow, /ProofMode surfaces unchanged after removing the bounded GitHub-only route additions/);
});

test('direct ProofMode files still force live proof', () => {
  assert.match(workflow, /worker\/proofmode-mcp\\\.js/);
  assert.match(workflow, /worker\/index\\\.js/);
  assert.match(workflow, /e2e\/proofmode-mcp\\\.pw\\\.mjs/);
});
