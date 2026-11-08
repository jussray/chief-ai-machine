import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONTROL_ROOM_RUNTIME_STATE_SCHEMA_VERSION = 1;
export const EXTERNAL_STATE_EVENT = 'runtime_state_changed';
const EPOCH_RE = /^sha256:[0-9a-f]{64}$/u;
const SOURCE_RE = /^[a-z0-9][a-z0-9._:/-]{1,127}$/u;

const ROOT_FILES = [
  '.env.example', 'app.config.js', 'app.config.ts', 'app.json', 'control-room.manifest.json',
  'package-lock.json', 'package.json', 'playwright.config.js', 'playwright.config.mjs',
  'playwright.config.ts', 'pnpm-lock.yaml', 'tsconfig.json', 'vite.config.js', 'vite.config.mjs',
  'vite.config.ts', 'wrangler.json', 'wrangler.jsonc', 'wrangler.toml', 'yarn.lock',
];
const TREE_ROOTS = ['.control-room', '.github/workflows', 'config'];

function clean(value) { return typeof value === 'string' ? value.trim() : ''; }
function normalizeSha(value) { return clean(value).toLowerCase(); }

function regularFiles(root, relativeDir) {
  const absolute = path.join(root, relativeDir);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isDirectory()) return [];
  const out = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.posix.join(relativeDir.replaceAll('\\\\', '/'), entry.name);
    if (entry.isDirectory()) out.push(...regularFiles(root, relative));
    else if (entry.isFile()) out.push(relative);
  }
  return out;
}

export function trackedConfigPaths(root = process.cwd()) {
  const paths = new Set();
  for (const relative of ROOT_FILES) {
    const absolute = path.join(root, relative);
    if (fs.existsSync(absolute) && fs.statSync(absolute).isFile()) paths.add(relative);
  }
  for (const relativeDir of TREE_ROOTS) for (const relative of regularFiles(root, relativeDir)) paths.add(relative);
  const supabaseConfig = path.join(root, 'supabase', 'config.toml');
  if (fs.existsSync(supabaseConfig) && fs.statSync(supabaseConfig).isFile()) paths.add('supabase/config.toml');
  return [...paths].sort();
}

export function trackedConfigFingerprint(root = process.cwd()) {
  const files = trackedConfigPaths(root);
  const hash = createHash('sha256');
  for (const relative of files) {
    hash.update(relative, 'utf8'); hash.update('\\0', 'utf8');
    hash.update(fs.readFileSync(path.join(root, relative))); hash.update('\\0', 'utf8');
  }
  return { files, sha256: `sha256:${hash.digest('hex')}` };
}

export function buildRuntimeStateReceipt(env = process.env, root = process.cwd(), observedAt = new Date()) {
  const eventName = clean(env.GITHUB_EVENT_NAME);
  const eventAction = clean(env.CONTROL_ROOM_EXTERNAL_STATE_ACTION);
  const runAttempt = Number.parseInt(clean(env.GITHUB_RUN_ATTEMPT) || '1', 10);
  const externalStateEpoch = clean(env.CONTROL_ROOM_EXTERNAL_STATE_EPOCH).toLowerCase();
  const externalStateSource = clean(env.CONTROL_ROOM_EXTERNAL_STATE_SOURCE).toLowerCase();
  const repository = clean(env.GITHUB_REPOSITORY);
  const sourceSha = normalizeSha(env.EXPECTED_HEAD_SHA || env.GITHUB_SHA);
  const outputPath = clean(env.CONTROL_ROOM_RUNTIME_STATE_PATH) || 'artifacts/control-room-runtime-state.json';
  const isExternalDispatch = eventName === 'repository_dispatch' && eventAction === EXTERNAL_STATE_EVENT;
  const isManualExternalRevalidation = eventName === 'workflow_dispatch' && Boolean(externalStateEpoch || externalStateSource);
  const requiresExternalState = isExternalDispatch || isManualExternalRevalidation;

  if (!Number.isSafeInteger(runAttempt) || runAttempt < 1) throw new Error('GITHUB_RUN_ATTEMPT must be a positive integer.');
  if (eventName === 'repository_dispatch' && eventAction !== EXTERNAL_STATE_EVENT) throw new Error(`Unsupported repository_dispatch action: ${eventAction || 'missing'}.`);
  if (requiresExternalState && runAttempt !== 1) throw new Error('External-state revalidation must be a newly queued workflow run; reruns are not accepted as fresh proof.');
  if (requiresExternalState && !EPOCH_RE.test(externalStateEpoch)) throw new Error('CONTROL_ROOM_EXTERNAL_STATE_EPOCH must be a non-secret sha256 state epoch. Never hash raw secret values.');
  if (requiresExternalState && !SOURCE_RE.test(externalStateSource)) throw new Error('CONTROL_ROOM_EXTERNAL_STATE_SOURCE must identify the provider or authority that observed the state change.');
  if (!repository || !sourceSha) throw new Error('GITHUB_REPOSITORY and EXPECTED_HEAD_SHA/GITHUB_SHA are required.');

  const tracked = trackedConfigFingerprint(root);
  return {
    schemaVersion: CONTROL_ROOM_RUNTIME_STATE_SCHEMA_VERSION,
    repository, sourceSha, observedAt: observedAt.toISOString(),
    event: { name: eventName || null, action: eventAction || null, runAttempt, freshQueue: runAttempt === 1 },
    trackedConfig: { sha256: tracked.sha256, paths: tracked.files },
    externalState: { mode: requiresExternalState ? 'fresh-revalidation' : 'source-bound', epoch: requiresExternalState ? externalStateEpoch : null, source: requiresExternalState ? externalStateSource : null, rawSecretMaterialRecorded: false },
    proofRule: { rerunCountsAsFreshExternalStateProof: false, sourceShaAloneProvesExternalState: false, trackedConfigFingerprintRequired: true },
    outputPath,
  };
}

export function writeRuntimeStateReceipt(env = process.env, root = process.cwd()) {
  const receipt = buildRuntimeStateReceipt(env, root);
  fs.mkdirSync(path.dirname(receipt.outputPath), { recursive: true });
  fs.writeFileSync(receipt.outputPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receipt;
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  try { console.log(JSON.stringify(writeRuntimeStateReceipt(), null, 2)); }
  catch (error) { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exit(1); }
}
