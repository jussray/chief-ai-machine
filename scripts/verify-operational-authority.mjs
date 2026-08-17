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
  'disablePersistedCheckoutCredentials',
  'cancelSupersededPullRequestRuns',
  'singleFullCoverageExecutionPerWorkflow',
  'providerBuildSuccessIsNotRuntimeProof',
  'providerPreviewIsNotProductionAuthority',
  'uiAndRuntimeClaimsRequirePlaywright',
  'unknownOrMissingAuthorityFailsClosed',
];

const REQUIRED_TEMPORAL_AUTHORITY = Object.freeze({
  currentFounderIntent: 'authoritative-for-founder-preferences-and-goals',
  futureYou: 'advisory-only',
  historicalIntentOnConflict: 'superseded-reconfirm-before-use',
  runtimeFacts: 'provider-evidence-authoritative',
  executionAuthorization: 'bind-to-current-intent-and-exact-proposal',
});

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

function indentation(line) {
  return String(line || '').match(/^\s*/)?.[0].length ?? 0;
}

function checkoutDisablesPersistedCredentials(lines, usesIndex) {
  const usesIndent = indentation(lines[usesIndex]);
  for (let index = usesIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('- ') && indentation(line) <= usesIndent) break;
    if (/^persist-credentials:\s*false\s*(?:#.*)?$/i.test(trimmed)) return true;
  }
  return false;
}

function pullRequestWorkflowCancelsSupersededRuns(text) {
  const value = String(text || '');
  if (!/^\s*pull_request\s*:/m.test(value)) return true;
  const hasConcurrency = /^\s*concurrency\s*:/m.test(value);
  const cancelsInProgress = /^\s*cancel-in-progress:\s*true\s*(?:#.*)?$/mi.test(value);
  return hasConcurrency && cancelsInProgress;
}

export function scanWorkflowText(text, workflow = 'unknown') {
  const value = String(text || '');
  const findings = [];
  const lines = value.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(/^\s*-?\s*uses:\s*([^#]+?)(?:\s+#.*)?$/);
    if (!match) return;
    const result = auditActionReference(match[1]);
    findings.push({ workflow, line: index + 1, ...result });
    if (
      result.ok
      && result.reference.startsWith('actions/checkout@')
      && !checkoutDisablesPersistedCredentials(lines, index)
    ) {
      findings.push({
        workflow,
        line: index + 1,
        ok: false,
        classification: 'checkout-persist-credentials-enabled',
        reference: result.reference,
      });
    }
  });

  if (!pullRequestWorkflowCancelsSupersededRuns(value)) {
    findings.push({
      workflow,
      line: 1,
      ok: false,
      classification: 'superseded-pr-runs-not-cancelled',
      reference: 'workflow-concurrency',
    });
  }
  return findings;
}

export function scanWorkflowBudget(text, workflow = 'unknown') {
  const lines = String(text || '').split(/\r?\n/);
  const fullCoverageLines = [];
  lines.forEach((line, index) => {
    if (/^\s*-\s*run:\s*npm\s+test\b.*--coverage\b/i.test(line)) {
      fullCoverageLines.push(index + 1);
    }
  });

  const violations = fullCoverageLines.length > 1
    ? [{
        classification: 'duplicate-full-suite-coverage-execution',
        workflow,
        count: fullCoverageLines.length,
        lines: fullCoverageLines,
        reason: 'one workflow must execute the full coverage suite once and reuse the resulting receipt',
      }]
    : [];

  return {
    workflow,
    fullCoverageExecutions: fullCoverageLines.length,
    lines: fullCoverageLines,
    violations,
  };
}

export function validateTemporalAuthority(authority) {
  const source = authority && typeof authority === 'object' && !Array.isArray(authority)
    ? authority
    : {};
  return Object.entries(REQUIRED_TEMPORAL_AUTHORITY)
    .filter(([key, expected]) => clean(source[key]) !== expected)
    .map(([key, expected]) => ({
      classification: 'temporal-authority-mismatch',
      key,
      expected,
      actual: clean(source[key]) || null,
    }));
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

  const uniqueApplied = new Map();
  for (const finding of annotated.filter((item) => item.waived)) {
    const key = waiverKey(finding.workflow, finding.reference);
    if (!uniqueApplied.has(key)) {
      uniqueApplied.set(key, {
        workflow: finding.workflow,
        line: finding.line,
        reference: finding.reference,
        tracking: finding.waiver.tracking,
        removalGate: finding.waiver.removalGate,
      });
    }
  }

  return {
    findings: annotated,
    waiversApplied: [...uniqueApplied.values()],
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
  const temporalAuthorityViolations = validateTemporalAuthority(config?.temporalAuthority);

  const files = workflowFiles(rootDir);
  const rawFindings = files.flatMap((file) => (
    scanWorkflowText(fs.readFileSync(file, 'utf8'), path.relative(rootDir, file))
  ));
  const workflowBudget = files.map((file) => (
    scanWorkflowBudget(fs.readFileSync(file, 'utf8'), path.relative(rootDir, file))
  ));
  const workflowBudgetViolations = workflowBudget.flatMap((item) => item.violations);

  const waivers = Array.isArray(config?.workflowAuthorityWaivers)
    ? config.workflowAuthorityWaivers
    : [];
  const invalidWaivers = validateWorkflowAuthorityWaivers(waivers);
  const waiverResult = applyWorkflowAuthorityWaivers(rawFindings, waivers);
  const actionViolations = waiverResult.findings.filter((finding) => !finding.ok && !finding.waived);
  const violations = [
    ...ruleViolations,
    ...temporalAuthorityViolations,
    ...workflowBudgetViolations,
    ...invalidWaivers,
    ...waiverResult.unusedWaivers,
    ...actionViolations,
  ];
  const report = {
    schemaVersion: 1,
    project: config?.project || null,
    truthSource: config?.truthSource || null,
    temporalAuthority: config?.temporalAuthority || null,
    temporalAuthorityViolations,
    workflowsScanned: files.length,
    actionReferencesScanned: rawFindings.filter((finding) => (
      !['checkout-persist-credentials-enabled', 'superseded-pr-runs-not-cancelled'].includes(finding.classification)
    )).length,
    immutableActionReferences: rawFindings.filter((finding) => finding.classification === 'immutable-action-sha').length,
    mutableActionReferences: rawFindings.filter((finding) => finding.classification === 'mutable-action-reference').length,
    checkoutCredentialViolations: rawFindings.filter((finding) => finding.classification === 'checkout-persist-credentials-enabled').length,
    supersededRunCancellationViolations: rawFindings.filter((finding) => finding.classification === 'superseded-pr-runs-not-cancelled').length,
    workflowBudget: {
      fullCoverageExecutions: workflowBudget.reduce((sum, item) => sum + item.fullCoverageExecutions, 0),
      duplicateFullCoverageViolations: workflowBudgetViolations.length,
    },
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
