import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FULL_SHA_ACTION = /^[^@\s]+@[0-9a-f]{40}$/i;
const TRACKING_REF = /^#\d+$/;
const WORKFLOW_PATH = /^\.github\/workflows\/[^*\s]+\.ya?ml$/i;
const VERIFY_COMMAND = /^node\s+scripts\/verify-[a-zA-Z0-9._/-]+(?:\s+.*)?$/;
const REQUIRED_RULES = [
  'auditExactMainBeforeEdits',
  'auditExactMainBeforeMerge',
  'singleAuthoritativeRepairLane',
  'pinThirdPartyActionsToFullCommitSha',
  'disablePersistedCheckoutCredentials',
  'cancelSupersededPullRequestRuns',
  'singleFullCoverageExecutionPerWorkflow',
  'singleOwnerPerVerificationResponsibility',
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
const mirrorKey = (command, mirror) => `${clean(command)}\u0000${clean(mirror)}`;

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
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    if (/\bnpm\s+test\b.*--coverage\b/i.test(trimmed)) {
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

export function extractRunCommands(text) {
  const lines = String(text || '').split(/\r?\n/);
  const commands = [];
  const blockMarkers = new Set(['|', '>', '|-', '>-', '|+', '>+']);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = line.match(/^\s*-?\s*run:\s*(.*)$/);
    if (!match) continue;

    const inline = clean(match[1]);
    if (inline && !blockMarkers.has(inline)) {
      commands.push({ line: index + 1, command: inline });
      continue;
    }

    const runIndent = indentation(line);
    const block = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const candidate = lines[cursor];
      if (candidate.trim() && indentation(candidate) <= runIndent) break;
      if (!candidate.trim()) continue;
      block.push(candidate.trim());
    }
    if (block.length > 0) commands.push({ line: index + 1, command: block.join('\n') });
  }

  return commands;
}

function normalizeShellCommand(command) {
  return clean(command).replace(/\s+/g, ' ');
}

export function canonicalizeVerificationCommand(command, packageScripts = {}) {
  const value = normalizeShellCommand(command);
  if (!value || value.startsWith('#')) return null;

  const npmRun = value.match(/^npm\s+run\s+([a-zA-Z0-9:_-]+)$/);
  const resolved = npmRun ? normalizeShellCommand(packageScripts?.[npmRun[1]]) : value;
  if (!resolved || !VERIFY_COMMAND.test(resolved)) return null;
  return resolved;
}

function workflowVerificationOccurrences(text, workflow, packageScripts) {
  const occurrences = [];
  for (const run of extractRunCommands(text)) {
    const commandLines = run.command.split(/\r?\n/);
    commandLines.forEach((commandLine, offset) => {
      const canonical = canonicalizeVerificationCommand(commandLine, packageScripts);
      if (!canonical) return;
      occurrences.push({
        command: canonical,
        workflow,
        line: run.line + offset,
      });
    });
  }
  return occurrences;
}

export function validateWorkflowResponsibilityMirrors(mirrors) {
  const list = Array.isArray(mirrors) ? mirrors : [];
  const invalid = [];
  const seen = new Set();

  for (const entry of list) {
    const command = normalizeShellCommand(entry?.command);
    const owner = clean(entry?.owner);
    const mirror = clean(entry?.mirror);
    const tracking = clean(entry?.tracking);
    const rationale = clean(entry?.rationale);
    const removalGate = clean(entry?.removalGate);
    const key = mirrorKey(command, mirror);
    const reasons = [];

    if (!VERIFY_COMMAND.test(command)) reasons.push('command must be one exact node scripts/verify-* command');
    if (!WORKFLOW_PATH.test(owner)) reasons.push('owner must be one exact .github/workflows YAML path');
    if (!WORKFLOW_PATH.test(mirror)) reasons.push('mirror must be one exact .github/workflows YAML path');
    if ([command, owner, mirror, tracking, rationale, removalGate].some((value) => value.includes('*'))) {
      reasons.push('wildcards are forbidden');
    }
    if (owner && mirror && owner === mirror) reasons.push('owner and mirror must be different workflows');
    if (!TRACKING_REF.test(tracking)) reasons.push('tracking must be an exact #number');
    if (!rationale) reasons.push('rationale is required');
    if (!removalGate) reasons.push('removalGate is required');
    if (seen.has(key)) reasons.push('duplicate command/mirror disposition');
    seen.add(key);

    if (reasons.length > 0) {
      invalid.push({
        classification: 'invalid-workflow-responsibility-mirror',
        command,
        owner,
        mirror,
        tracking,
        reasons,
      });
    }
  }

  return invalid;
}

export function auditWorkflowResponsibilities({ workflows, packageScripts = {}, mirrors = [] } = {}) {
  const workflowList = Array.isArray(workflows) ? workflows : [];
  const mirrorList = Array.isArray(mirrors) ? mirrors : [];
  const occurrences = workflowList.flatMap(({ workflow, text }) => (
    workflowVerificationOccurrences(text, workflow, packageScripts)
  ));
  const byCommand = new Map();
  for (const occurrence of occurrences) {
    if (!byCommand.has(occurrence.command)) byCommand.set(occurrence.command, []);
    byCommand.get(occurrence.command).push(occurrence);
  }

  const violations = [];
  const intentionalMirrors = [];
  const usedMirrorKeys = new Set();
  const duplicates = [];

  for (const [command, commandOccurrences] of byCommand) {
    const actualWorkflows = [...new Set(commandOccurrences.map((item) => item.workflow))].sort();
    if (actualWorkflows.length <= 1) continue;

    duplicates.push({ command, workflows: actualWorkflows });
    const dispositions = mirrorList.filter((entry) => normalizeShellCommand(entry?.command) === command);
    const owners = [...new Set(dispositions.map((entry) => clean(entry?.owner)).filter(Boolean))];
    const owner = owners.length === 1 ? owners[0] : null;
    const allowed = new Set(owner ? [owner] : []);
    for (const entry of dispositions) allowed.add(clean(entry?.mirror));
    const undisposed = actualWorkflows.filter((workflow) => !allowed.has(workflow));

    if (!owner || !actualWorkflows.includes(owner) || undisposed.length > 0) {
      violations.push({
        classification: 'duplicate-workflow-verification-responsibility',
        command,
        workflows: actualWorkflows,
        owner,
        undisposedWorkflows: undisposed,
        reason: 'one verification responsibility may span workflows only with an exact owner and tracked mirror disposition',
      });
      continue;
    }

    for (const entry of dispositions) {
      const mirror = clean(entry?.mirror);
      if (!actualWorkflows.includes(mirror)) continue;
      usedMirrorKeys.add(mirrorKey(command, mirror));
      intentionalMirrors.push({
        command,
        owner,
        mirror,
        tracking: clean(entry?.tracking),
        rationale: clean(entry?.rationale),
        removalGate: clean(entry?.removalGate),
      });
    }
  }

  const unusedMirrors = mirrorList
    .filter((entry) => !usedMirrorKeys.has(mirrorKey(normalizeShellCommand(entry?.command), entry?.mirror)))
    .map((entry) => ({
      classification: 'unused-workflow-responsibility-mirror',
      command: normalizeShellCommand(entry?.command),
      owner: clean(entry?.owner),
      mirror: clean(entry?.mirror),
      tracking: clean(entry?.tracking),
      reason: 'registered mirror no longer matches a duplicated verification responsibility and must be removed',
    }));

  return {
    occurrences,
    duplicates,
    intentionalMirrors,
    unusedMirrors,
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
  const packagePath = path.join(rootDir, 'package.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const packageConfig = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const ruleViolations = REQUIRED_RULES
    .filter((rule) => config?.workflowRules?.[rule] !== true)
    .map((rule) => ({ classification: 'missing-required-rule', rule }));
  const temporalAuthorityViolations = validateTemporalAuthority(config?.temporalAuthority);

  const files = workflowFiles(rootDir);
  const workflowTexts = files.map((file) => ({
    workflow: path.relative(rootDir, file),
    text: fs.readFileSync(file, 'utf8'),
  }));
  const rawFindings = workflowTexts.flatMap(({ workflow, text }) => (
    scanWorkflowText(text, workflow)
  ));
  const workflowBudget = workflowTexts.map(({ workflow, text }) => (
    scanWorkflowBudget(text, workflow)
  ));
  const workflowBudgetViolations = workflowBudget.flatMap((item) => item.violations);

  const responsibilityMirrors = Array.isArray(config?.workflowResponsibilityMirrors)
    ? config.workflowResponsibilityMirrors
    : [];
  const invalidResponsibilityMirrors = validateWorkflowResponsibilityMirrors(responsibilityMirrors);
  const responsibilityAudit = auditWorkflowResponsibilities({
    workflows: workflowTexts,
    packageScripts: packageConfig?.scripts || {},
    mirrors: responsibilityMirrors,
  });

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
    ...invalidResponsibilityMirrors,
    ...responsibilityAudit.violations,
    ...responsibilityAudit.unusedMirrors,
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
      duplicatedVerificationResponsibilities: responsibilityAudit.duplicates.length,
      undisposedVerificationDuplicates: responsibilityAudit.violations.length,
      intentionalVerificationMirrors: responsibilityAudit.intentionalMirrors,
    },
    invalidResponsibilityMirrors,
    unusedResponsibilityMirrors: responsibilityAudit.unusedMirrors,
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
