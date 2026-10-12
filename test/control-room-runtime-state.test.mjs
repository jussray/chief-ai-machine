import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildRuntimeStateReceipt, trackedConfigFingerprint } from '../scripts/control-room-runtime-state.mjs';

const SHA = 'a'.repeat(40);
const EPOCH = `sha256:${'b'.repeat(64)}`;
function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'control-room-runtime-state-'));
  fs.mkdirSync(path.join(root, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'name: CI\\n', 'utf8');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"fixture"}\\n', 'utf8');
  return root;
}
function env(overrides = {}) { return { GITHUB_EVENT_NAME: 'push', GITHUB_RUN_ATTEMPT: '1', GITHUB_REPOSITORY: 'jussray/example', EXPECTED_HEAD_SHA: SHA, CONTROL_ROOM_RUNTIME_STATE_PATH: 'artifacts/control-room-runtime-state.json', ...overrides }; }

test('tracked configuration movement changes the receipt fingerprint', () => {
  const root = fixture(); const before = trackedConfigFingerprint(root);
  fs.appendFileSync(path.join(root, '.github', 'workflows', 'ci.yml'), 'on: push\\n', 'utf8');
  const after = trackedConfigFingerprint(root);
  assert.notEqual(before.sha256, after.sha256);
  assert.deepEqual(before.files, ['.github/workflows/ci.yml', 'package.json']);
});

test('ordinary source events stay source-bound and do not pretend to prove provider state', () => {
  const receipt = buildRuntimeStateReceipt(env(), fixture(), new Date('2026-10-12T22:00:00Z'));
  assert.equal(receipt.externalState.mode, 'source-bound'); assert.equal(receipt.externalState.epoch, null);
  assert.equal(receipt.proofRule.sourceShaAloneProvesExternalState, false);
});

test('external state invalidation requires a fresh queue, non-secret epoch, and source', () => {
  const root = fixture();
  const valid = env({ GITHUB_EVENT_NAME: 'repository_dispatch', CONTROL_ROOM_EXTERNAL_STATE_ACTION: 'runtime_state_changed', CONTROL_ROOM_EXTERNAL_STATE_EPOCH: EPOCH, CONTROL_ROOM_EXTERNAL_STATE_SOURCE: 'cloudflare:project' });
  const receipt = buildRuntimeStateReceipt(valid, root);
  assert.equal(receipt.externalState.mode, 'fresh-revalidation'); assert.equal(receipt.externalState.epoch, EPOCH); assert.equal(receipt.event.freshQueue, true);
  assert.throws(() => buildRuntimeStateReceipt({ ...valid, GITHUB_RUN_ATTEMPT: '2' }, root), /newly queued/u);
  assert.throws(() => buildRuntimeStateReceipt({ ...valid, CONTROL_ROOM_EXTERNAL_STATE_EPOCH: '' }, root), /state epoch/u);
  assert.throws(() => buildRuntimeStateReceipt({ ...valid, CONTROL_ROOM_EXTERNAL_STATE_SOURCE: '' }, root), /SOURCE/u);
});

test('manual external revalidation follows the same fresh-run contract', () => {
  const receipt = buildRuntimeStateReceipt(env({ GITHUB_EVENT_NAME: 'workflow_dispatch', CONTROL_ROOM_EXTERNAL_STATE_EPOCH: EPOCH, CONTROL_ROOM_EXTERNAL_STATE_SOURCE: 'github:environment' }), fixture());
  assert.equal(receipt.externalState.mode, 'fresh-revalidation');
});

test('the ledger workflow exposes the external-state invalidation trigger', () => {
  const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const workflow = fs.readFileSync(path.join(repositoryRoot, '.github', 'workflows', 'control-room-test-ledger.yml'), 'utf8');
  for (const expected of ['repository_dispatch:', 'types: [runtime_state_changed]', 'external_state_epoch:', 'CONTROL_ROOM_EXTERNAL_STATE_EPOCH:', 'CONTROL_ROOM_EXTERNAL_STATE_SOURCE:', 'node --test test/control-room-runtime-state.test.mjs', 'node scripts/control-room-runtime-state.mjs', 'artifacts/control-room-runtime-state.json']) assert.ok(workflow.includes(expected), `workflow missing ${expected}`);
});
