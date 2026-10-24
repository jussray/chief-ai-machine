import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import test from 'node:test';
import { scanAddedLines } from '../scripts/verify-sauce-guard-egress.mjs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const entrypoints = ["AGENTS.md","CHATGPT.md","CLAUDE.md","PERPLEXITY.md","AGENTS_FOUNDER_INTELLIGENCE.md"];
const skill = 'jussray/founder-control-room/.agents/skills/sauce-guard/SKILL.md';

test('all contributor and AI-agent entry points inherit canonical Sauce Guard', () => {
  for (const path of entrypoints) {
    const content = read(path);
    assert.ok(content.includes(skill), `${path}: canonical skill`);
    assert.ok(content.includes('Current You'), `${path}: exact approval`);
    assert.ok(content.includes('provider readback'), `${path}: publication proof`);
    assert.ok(content.includes('verify-sauce-guard-egress.mjs'), `${path}: logger guard`);
  }
});

test('dynamic log arguments are blocked, while fixed opaque event codes are allowed', () => {
  const wrap = line => `diff --git a/src/thing.ts b/src/thing.ts\n+++ b/src/thing.ts\n@@ -1 +1 @@\n+${line}\n`;
  assert.deepEqual(scanAddedLines(wrap("console.error('SAUCE_GUARD_REQUEST_DENIED');")), []);
  for (const line of [
    'console.log(userId);',
    'console.error(error.message);',
    'console.info(JSON.stringify(providerResponse));',
    'logger.warn(customerEmail);',
    'process.stderr.write(secret);',
    'console.log(`user=${userId}`);',
    'console.log(',
  ]) assert.equal(scanAddedLines(wrap(line)).length, 1, line);
});

test('scanner does not disclose source and excludes unrelated docs', () => {
  assert.equal(scanAddedLines('+++ b/docs/notes.md\n@@ -1 +1 @@\n+console.log(secret)\n').length, 0);
  const a = scanAddedLines('+++ b/worker/auth.ts\n@@ -9 +9 @@\n+console.log(accountId);\n');
  assert.deepEqual(a, [{ path: 'worker/auth.ts', line: 9, reason: 'SAUCE_GUARD_DYNAMIC_LOG' }]);
  assert.equal(JSON.stringify(a).includes('accountId'), false);
});

test('established PR/push CI job executes Sauce Guard tests and blocks dynamic logs', () => {
  const workflow = read('.github/workflows/control-room-contracts.yml');
  assert.ok(workflow.includes('node --test test/sauce-guard-egress.check.mjs'));
  assert.ok(workflow.includes('node scripts/verify-sauce-guard-egress.mjs --base='));
  assert.ok(workflow.includes('SAUCE_GUARD_BASE_SHA'));
});
