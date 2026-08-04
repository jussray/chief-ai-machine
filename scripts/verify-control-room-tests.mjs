import {access, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_REPOSITORY = 'jussray/chief-ai-machine';
const ALLOWED_KINDS = new Set(['typecheck', 'lint', 'unit', 'integration', 'e2e', 'contract', 'security', 'build', 'deployment', 'other']);
const ALLOWED_STATUSES = new Set(['active', 'founder-gated', 'missing', 'retired']);

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

function scriptName(command) {
  const match = command.match(/^npm run ([a-zA-Z0-9:_-]+)$/);
  return match?.[1] ?? null;
}

const raw = await readFile('control-room.manifest.json', 'utf8');
const manifest = JSON.parse(raw);
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
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
    if (typeof file !== 'string' || file.startsWith('/') || file.includes('\\') || file.split('/').includes('..')) {
      entryErrors.push(`unsafe evidence path: ${String(file)}`);
    } else if (!(await exists(file))) {
      missing.push(file);
    }
  }
  if (missing.length) entryErrors.push(`missing evidence: ${missing.join(', ')}`);
  tests.push({id: entry.id, kind: entry.kind, status: entry.status, required: entry.required, catalogValid: entryErrors.length === 0});
  for (const error of entryErrors) errors.push(`${entry.id || 'unknown'}: ${error}`);
}

if (/(api[_-]?key|secret\s*[:=]|token\s*[:=]|sk-[a-z0-9_-]{10,})/i.test(raw)) errors.push('manifest appears to contain secret material');

const report = {
  schemaVersion: 1,
  repository: EXPECTED_REPOSITORY,
  status: errors.length === 0 ? 'passed' : 'failed',
  generatedAt: new Date().toISOString(),
  tests,
  summary: {total: tests.length, active: tests.filter((item) => item.status === 'active').length, invalid: tests.filter((item) => !item.catalogValid).length},
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
