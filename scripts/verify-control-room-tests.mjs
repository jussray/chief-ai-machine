import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_REPOSITORY = 'jussray/chief-ai-machine';
const EXPECTED_PROJECT_ID = 'chief-ai-machine';
const CANONICAL_MANIFEST_PATH = '.control-room/repository.manifest.json';
const ALLOWED_KINDS = new Set(['typecheck', 'lint', 'unit', 'integration', 'e2e', 'contract', 'security', 'build', 'deployment', 'other']);
const ALLOWED_STATUSES = new Set(['active', 'founder-gated', 'missing', 'retired']);
const REQUIRED_LEDGER_SURFACES = [
  '.control-room/test-ledger.manifest.json',
  '.github/workflows/control-room-test-ledger.yml',
];
const REQUIRED_LOCAL_LEDGER_IDS = [
  'control-room-test-ledger-contract',
  'control-room-test-ledger-publish',
];
const REQUIRED_CANONICAL_LEDGER_SIGNALS = [
  'test-ledger-contract',
  'test-ledger-publish',
];
const SECRET_VALUE_PATTERN = /(?:api[_-]?key|secret|token)\s*[:=]\s*["']?[a-z0-9_./+=-]{8,}|sk-[a-z0-9_-]{10,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i;

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

function isSafeRelativePath(file) {
  return typeof file === 'string'
    && file.length > 0
    && !file.startsWith('/')
    && !file.includes('\\')
    && !file.split('/').includes('..');
}

function scriptName(command) {
  const match = command.match(/^npm run ([a-zA-Z0-9:_-]+)$/);
  return match?.[1] ?? null;
}

const [raw, canonicalRaw, packageRaw] = await Promise.all([
  readFile('control-room.manifest.json', 'utf8'),
  readFile(CANONICAL_MANIFEST_PATH, 'utf8'),
  readFile('package.json', 'utf8'),
]);
const manifest = JSON.parse(raw);
const canonical = JSON.parse(canonicalRaw);
const pkg = JSON.parse(packageRaw);
const errors = [];
const tests = [];

if (manifest.schemaVersion !== '1.0') errors.push('schemaVersion must be 1.0');
if (manifest.repository !== EXPECTED_REPOSITORY) errors.push(`repository must be ${EXPECTED_REPOSITORY}`);
if (manifest.controlRoom?.privateContentAllowed !== false) errors.push('private content must be denied');
if (manifest.tests?.rawLogsAllowed !== false) errors.push('raw logs must be denied');
if (!Array.isArray(manifest.tests?.catalog) || manifest.tests.catalog.length === 0) errors.push('tests.catalog must not be empty');

const ids = new Set();
for (const entry of Array.isArray(manifest.tests?.catalog) ? manifest.tests.catalog : []) {
  const entryErrors = [];
  if (typeof entry.id !== 'string' || !entry.id) entryErrors.push('id missing');
  if (ids.has(entry.id)) entryErrors.push('id duplicated');
  ids.add(entry.id);
  if (!ALLOWED_KINDS.has(entry.kind)) entryErrors.push('kind unsupported');
  if (!ALLOWED_STATUSES.has(entry.status)) entryErrors.push('status unsupported');
  if (typeof entry.command !== 'string' || entry.command.includes('\n') || entry.command.includes('\r')) entryErrors.push('command invalid');
  const name = scriptName(entry.command || '');
  if (name && !pkg.scripts?.[name]) entryErrors.push(`package script missing: ${name}`);
  if (!Array.isArray(entry.evidencePaths) || entry.evidencePaths.length === 0) entryErrors.push('evidence missing');
  const missing = [];
  for (const file of Array.isArray(entry.evidencePaths) ? entry.evidencePaths : []) {
    if (!isSafeRelativePath(file)) {
      entryErrors.push(`unsafe evidence path: ${String(file)}`);
    } else if (!(await exists(file))) {
      missing.push(file);
    }
  }
  if (missing.length) entryErrors.push(`missing evidence: ${missing.join(', ')}`);
  tests.push({id: entry.id, kind: entry.kind, status: entry.status, required: entry.required, catalogValid: entryErrors.length === 0});
  for (const error of entryErrors) errors.push(`${entry.id || 'unknown'}: ${error}`);
}

for (const surface of REQUIRED_LEDGER_SURFACES) {
  if (!manifest.controlRoom?.surfaces?.includes(surface)) errors.push(`local surface missing: ${surface}`);
}
for (const id of REQUIRED_LOCAL_LEDGER_IDS) {
  if (!ids.has(id)) errors.push(`local ledger catalog missing: ${id}`);
}

if (canonical.schemaVersion !== '1.0') errors.push('canonical schemaVersion must be 1.0');
if (canonical.projectId !== EXPECTED_PROJECT_ID) errors.push(`canonical projectId must be ${EXPECTED_PROJECT_ID}`);
if (canonical.repository?.identifier !== EXPECTED_REPOSITORY) errors.push(`canonical repository must be ${EXPECTED_REPOSITORY}`);

const requiredSignals = Array.isArray(canonical.verification?.requiredSignals)
  ? canonical.verification.requiredSignals
  : [];
const canonicalCatalog = Array.isArray(canonical.verification?.testCatalog)
  ? canonical.verification.testCatalog
  : [];
if (requiredSignals.length === 0) errors.push('canonical requiredSignals must not be empty');
if (canonicalCatalog.length === 0) errors.push('canonical testCatalog must not be empty');

const signalIds = new Set();
for (const signal of requiredSignals) {
  if (typeof signal?.id !== 'string' || !signal.id) {
    errors.push('canonical signal id missing');
    continue;
  }
  if (signalIds.has(signal.id)) errors.push(`canonical signal duplicated: ${signal.id}`);
  signalIds.add(signal.id);
  if (typeof signal.name !== 'string' || !signal.name) errors.push(`canonical signal name missing: ${signal.id}`);
  if (signal.required !== true) errors.push(`canonical signal must be required: ${signal.id}`);
}

const canonicalTestIds = new Set();
const coveredSignals = new Set();
for (const entry of canonicalCatalog) {
  if (typeof entry?.id !== 'string' || !entry.id) {
    errors.push('canonical test id missing');
    continue;
  }
  if (canonicalTestIds.has(entry.id)) errors.push(`canonical test duplicated: ${entry.id}`);
  canonicalTestIds.add(entry.id);
  if (!ALLOWED_KINDS.has(entry.kind)) errors.push(`canonical test kind unsupported: ${entry.id}`);
  if (!signalIds.has(entry.signalId)) errors.push(`canonical test has undeclared signal: ${entry.id}`);
  else coveredSignals.add(entry.signalId);
  if (entry.required !== true) errors.push(`canonical test must be required: ${entry.id}`);
  if (typeof entry.command !== 'string' || !entry.command || entry.command.includes('\n') || entry.command.includes('\r')) {
    errors.push(`canonical command invalid: ${entry.id}`);
  }
  if (!isSafeRelativePath(entry.workflow)) {
    errors.push(`canonical workflow path unsafe: ${entry.id}`);
  } else if (!(await exists(entry.workflow))) {
    errors.push(`canonical workflow missing: ${entry.workflow}`);
  }
}
for (const signalId of signalIds) {
  if (!coveredSignals.has(signalId)) errors.push(`canonical required signal has no test: ${signalId}`);
}
for (const signalId of REQUIRED_CANONICAL_LEDGER_SIGNALS) {
  if (!signalIds.has(signalId)) errors.push(`canonical ledger signal missing: ${signalId}`);
}
for (const id of REQUIRED_LOCAL_LEDGER_IDS) {
  if (!canonicalTestIds.has(id)) errors.push(`canonical ledger catalog missing: ${id}`);
}

for (const capability of Array.isArray(canonical.capabilities) ? canonical.capabilities : []) {
  for (const signalId of Array.isArray(capability.requiredSignals) ? capability.requiredSignals : []) {
    if (!signalIds.has(signalId)) errors.push(`capability ${capability.id || 'unknown'} uses undeclared signal: ${signalId}`);
  }
}

if (SECRET_VALUE_PATTERN.test(`${raw}\n${canonicalRaw}`)) {
  errors.push('Control Room manifests appear to contain secret material');
}

const report = {
  schemaVersion: 1,
  repository: EXPECTED_REPOSITORY,
  status: errors.length === 0 ? 'passed' : 'failed',
  generatedAt: new Date().toISOString(),
  tests,
  summary: {
    total: tests.length,
    active: tests.filter((item) => item.status === 'active').length,
    invalid: tests.filter((item) => !item.catalogValid).length,
    canonicalSignals: signalIds.size,
    canonicalTests: canonicalTestIds.size,
  },
};

const reportPath = process.env.CONTROL_ROOM_TEST_REPORT_PATH;
if (reportPath) {
  await mkdir(path.dirname(reportPath), {recursive: true});
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

if (errors.length) {
  console.error('Chief AI control-room catalog failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(JSON.stringify(report));
