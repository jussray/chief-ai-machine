import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FULL_SHA_ACTION = /^[^@\s]+@[0-9a-f]{40}$/i;
const REQUIRED_RULES = [
  'auditExactMainBeforeEdits',
  'auditExactMainBeforeMerge',
  'singleAuthoritativeRepairLane',
  'pinThirdPartyActionsToFullCommitSha',
  'providerBuildSuccessIsNotRuntimeProof',
  'providerPreviewIsNotProductionAuthority',
  'uiAndRuntimeClaimsRequirePlaywright',
  'unknownOrMissingAuthorityFailsClosed',
];

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

export function auditActionReference(reference) {
  const value = clean(reference).replace(/^['"]|['"]$/g, '');
  if (!value) return { ok: false, classification: 'empty-action-reference', reference: value };
  if (value.startsWith('./')) return { ok: true, classification: 'local-action', reference: value };
  if (FULL_SHA_ACTION.test(value)) {
    return { ok: true, classification: 'immutable-action-sha', reference: value };
  }
  return { ok: false, classification: 'mutable-action-reference', reference: value };
}

export function scanWorkflowText(text, workflow = 'unknown') {
  const findings = [];
  const lines = String(text || '').split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^\s*-?\s*uses:\s*([^#]+?)(?:\s+#.*)?$/);
    if (!match) return;
    const result = auditActionReference(match[1]);
    findings.push({ workflow, line: index + 1, ...result });
  });
  return findings;
}

function workflowFiles(rootDir) {
  const directory = path.join(rootDir, '.github', 'workflows');
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => /\.ya?ml$/i.test(name))
    .sort()
    .map((name) => path.join(directory, name));
}

export function verifyOperationalAuthority({ rootDir = process.cwd() } = {}) {
  const configPath = path.join(rootDir, 'config', 'operational-authority.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const ruleViolations = REQUIRED_RULES
    .filter((rule) => config?.workflowRules?.[rule] !== true)
    .map((rule) => ({ classification: 'missing-required-rule', rule }));

  const findings = workflowFiles(rootDir).flatMap((file) => (
    scanWorkflowText(fs.readFileSync(file, 'utf8'), path.relative(rootDir, file))
  ));
  const actionViolations = findings.filter((finding) => !finding.ok);
  const report = {
    schemaVersion: 1,
    project: config?.project || null,
    truthSource: config?.truthSource || null,
    workflowsScanned: new Set(findings.map((finding) => finding.workflow)).size,
    actionReferencesScanned: findings.length,
    immutableActionReferences: findings.filter((finding) => finding.ok).length,
    violations: [...ruleViolations, ...actionViolations],
    ok: ruleViolations.length === 0 && actionViolations.length === 0,
  };
  return report;
}

export function writeOperationalAuthorityReport({
  rootDir = process.cwd(),
  outputPath = 'artifacts/operational-authority-report.json',
} = {}) {
  const report = verifyOperationalAuthority({ rootDir });
  const absoluteOutput = path.resolve(rootDir, outputPath);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  return report;
}

const isDirectExecution = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  const report = writeOperationalAuthorityReport();
  if (!report.ok) process.exit(1);
}
