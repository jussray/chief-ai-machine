import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FULL_SHA_ACTION = /^[^@\s]+@[0-9a-f]{40}$/i;
const TRACKING_REF = /^#\d+$/;
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
const waiverKey = (workflow, reference) => `${clean(workflow)}\u0000${clean(reference)}`;

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

export function validateWorkflowAuthorityWaivers(waivers) {
  const list = Array.isArray(waivers) ? waivers : [];
  const invalid = [];
  const seen = new Set();

  for (const waiver of list) {
    const workflow = clean(waiver?.workflow);
    const reference = clean(waiver?.reference);
    const tracking = clean(waiver?.tracking);
    const removalGate = clean(waiver?.removalGate);
    const key = waiverKey(workflow, reference);
    const reasons = [];

    if (!workflow.startsWith('.github/workflows/') || !/\.ya?ml$/i.test(workflow)) {
      reasons.push('workflow must be one exact .github/workflows YAML path');
    }
    if ([workflow, reference, tracking, removalGate].some((value) => value.includes('*'))) {
      reasons.push('wildcards are forbidden');
    }
    if (!reference || auditActionReference(reference).ok) {
      reasons.push('reference must be one exact mutable third-party action reference');
    }
    if (!TRACKING_REF.test(tracking)) reasons.push('tracking must be an exact #number');
    if (!removalGate) reasons.push('removalGate is required');
    if (seen.has(key)) reasons.push('duplicate workflow/reference waiver');
    seen.add(key);

    if (reasons.length > 0) {
      invalid.push({
        classification: 'invalid-authority-waiver',
        workflow,
        reference,
        tracking,
        reasons,
      });
    }
  }
  return invalid;
}

export function applyWorkflowAuthorityWaivers(findings, waivers) {
  const list = Array.isArray(findings) ? findings : [];
  const waiverList = Array.isArray(waivers) ? waivers : [];
  const waiverByKey = new Map(
    waiverList.map((waiver) => [waiverKey(waiver?.workflow, waiver?.reference), waiver]),
  );
  const appliedKeys = new Set();

  const annotated = list.map((finding) => {
    if (finding.ok) return { ...finding, waived: false };
    const key = waiverKey(finding.workflow, finding.reference);
    const waiver = waiverByKey.get(key);
    if (!waiver) return { ...finding, waived: false };
    appliedKeys.add(key);
    return {
      ...finding,
      waived: true,
      waiver: {
        tracking: clean(waiver.tracking),
        removalGate: clean(waiver.removalGate),
      },
    };
  });

  const unusedWaivers = waiverList
    .filter((waiver) => !appliedKeys.has(waiverKey(waiver?.workflow, waiver?.reference)))
    .map((waiver) => ({
      classification: 'unused-authority-waiver',
      workflow: clean(waiver?.workflow),
      reference: clean(waiver?.reference),
      tracking: clean(waiver?.tracking),
      reason: 'waiver no longer matches a mutable action reference and must be removed',
    }));

  return {
    findings: annotated,
    waiversApplied: annotated
      .filter((finding) => finding.waived)
      .map((finding) => ({
        workflow: finding.workflow,
        line: finding.line,
        reference: finding.reference,
        tracking: finding.waiver.tracking,
        removalGate: finding.waiver.removalGate,
      })),
    unusedWaivers,
  };
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

  const rawFindings = workflowFiles(rootDir).flatMap((file) => (
    scanWorkflowText(fs.readFileSync(file, 'utf8'), path.relative(rootDir, file))
  ));
  const waivers = Array.isArray(config?.workflowAuthorityWaivers)
    ? config.workflowAuthorityWaivers
    : [];
  const invalidWaivers = validateWorkflowAuthorityWaivers(waivers);
  const waiverResult = applyWorkflowAuthorityWaivers(rawFindings, waivers);
  const actionViolations = waiverResult.findings.filter((finding) => !finding.ok && !finding.waived);
  const violations = [
    ...ruleViolations,
    ...invalidWaivers,
    ...waiverResult.unusedWaivers,
    ...actionViolations,
  ];
  const report = {
    schemaVersion: 1,
    project: config?.project || null,
    truthSource: config?.truthSource || null,
    workflowsScanned: new Set(rawFindings.map((finding) => finding.workflow)).size,
    actionReferencesScanned: rawFindings.length,
    immutableActionReferences: rawFindings.filter((finding) => finding.ok).length,
    mutableActionReferences: rawFindings.filter((finding) => !finding.ok).length,
    waiversApplied: waiverResult.waiversApplied,
    invalidWaivers,
    unusedWaivers: waiverResult.unusedWaivers,
    violations,
    ok: violations.length === 0,
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
