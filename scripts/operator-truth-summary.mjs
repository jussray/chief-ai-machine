import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

export const FAILURE_PRIORITY = [
  'provider_observability_missing',
  'startup_failure',
  'runtime_transport_error',
  'runtime_http_error',
  'runtime_non_json',
  'runtime_json_missing_sha',
  'runtime_sha_mismatch',
  'runtime_unknown',
  'provider_build_failure',
  'repository_check_failure',
  'unknown_failure',
];

export function classifyCheckFailure(check) {
  const name = clean(check?.name).toLowerCase();
  const conclusion = clean(check?.conclusion).toLowerCase();
  const state = clean(check?.policyState || check?.state).toLowerCase();
  if (conclusion === 'success' || state === 'passed') return null;
  if (conclusion === 'startup_failure') return 'startup_failure';
  if (name.includes('provider receipt') || name.includes('cloudflare build diagnostic')) {
    return 'provider_observability_missing';
  }
  if (
    name.includes('exact chief runtime')
    || name.includes('production proofmode')
    || name.includes('live proofmode mcp')
    || name.includes('live chief capability plan')
  ) {
    return 'runtime_unknown';
  }
  if (name.startsWith('workers builds:')) return 'provider_build_failure';
  if (state === 'failed') return 'repository_check_failure';
  if (state === 'unknown') return 'unknown_failure';
  return null;
}

export function classifyRuntimeWitness(witness) {
  const classification = clean(witness?.classification).replaceAll('-', '_');
  const allowed = new Set([
    'runtime_transport_error',
    'runtime_http_error',
    'runtime_non_json',
    'runtime_json_missing_sha',
    'runtime_sha_mismatch',
    'runtime_exact_sha',
  ]);
  return allowed.has(classification) ? classification : 'runtime_unknown';
}

function ownerFor(failureClass) {
  if (['provider_observability_missing', 'provider_build_failure'].includes(failureClass)) {
    return 'provider-authority';
  }
  if (failureClass === 'startup_failure') return 'github-workflow-authority';
  if (failureClass?.startsWith('runtime_')) return 'runtime-routing';
  return 'repository';
}

function nextActionFor(failureClass) {
  const actions = {
    provider_observability_missing: 'restore read-only provider observability before changing runtime code',
    startup_failure: 'repair workflow authority before interpreting repository health',
    runtime_transport_error: 'verify hostname and network ownership before changing application logic',
    runtime_http_error: 'inspect exact runtime routing and response before changing application logic',
    runtime_non_json: 'inspect provider routing or deploy configuration because /version is not reaching the Worker JSON handler',
    runtime_json_missing_sha: 'repair the version receipt before making deployment claims',
    runtime_sha_mismatch: 'stop promotion and reconcile deployed identity with the exact candidate SHA',
    runtime_unknown: 'collect the structured runtime witness before choosing a code or provider fix',
    provider_build_failure: 'inspect exact provider build evidence before changing repository code',
    repository_check_failure: 'repair the smallest deterministic repository failure and rerun exact-head checks',
    unknown_failure: 'preserve UNKNOWN and gather evidence; do not infer green',
  };
  return actions[failureClass] || 'continue exact-head verification';
}

export function buildOperatorTruthSummary({ ledger, runtimeWitness = null }) {
  const checks = Array.isArray(ledger?.checks) ? ledger.checks : [];
  const failures = [];
  const nonBlockingSignals = [];
  const failureClassCounts = {};

  for (const check of checks) {
    const failureClass = classifyCheckFailure(check);
    if (!failureClass) continue;
    failureClassCounts[failureClass] = (failureClassCounts[failureClass] || 0) + 1;
    const state = clean(check?.policyState || check?.state) || 'unknown';
    const signal = {
      failureClass,
      checkName: clean(check?.name),
      state,
      detailsUrl: clean(check?.detailsUrl) || null,
    };
    if (state === 'warning') nonBlockingSignals.push(signal);
    else failures.push(signal);
  }

  if (runtimeWitness) {
    const runtimeClass = classifyRuntimeWitness(runtimeWitness);
    if (runtimeClass !== 'runtime_exact_sha') {
      failureClassCounts[runtimeClass] = (failureClassCounts[runtimeClass] || 0) + 1;
      failures.push({ failureClass: runtimeClass, checkName: 'runtime-witness', state: 'failed', detailsUrl: null });
    }
  }

  const priority = new Map(FAILURE_PRIORITY.map((value, index) => [value, index]));
  failures.sort((left, right) => (
    (priority.get(left.failureClass) ?? 999) - (priority.get(right.failureClass) ?? 999)
      || left.checkName.localeCompare(right.checkName)
  ));
  nonBlockingSignals.sort((left, right) => (
    (priority.get(left.failureClass) ?? 999) - (priority.get(right.failureClass) ?? 999)
      || left.checkName.localeCompare(right.checkName)
  ));

  const primary = failures[0] || null;
  const aggregateState = clean(ledger?.aggregate?.state) || 'unknown';
  const repositoryChecksGreen = aggregateState === 'passed' && !primary;
  return {
    schemaVersion: 1,
    repository: clean(ledger?.repository) || null,
    commitSha: clean(ledger?.commitSha) || null,
    aggregateState,
    repositoryChecksGreen,
    // Operator telemetry never grants merge authority. Independent review,
    // current-base binding, and live repository/provider policy are separate
    // authority surfaces and are intentionally not inferred from the ledger.
    mergeRecommended: false,
    mergeAuthority: {
      evaluated: false,
      state: 'not_evaluated',
      reason: 'operator truth summarizes repository/runtime evidence only; independent review and live merge-policy authority require separate provider-backed proof',
    },
    publicClaimAuthorized: false,
    primaryBlocker: primary
      ? {
          ...primary,
          owner: ownerFor(primary.failureClass),
          nextAction: nextActionFor(primary.failureClass),
        }
      : null,
    metrics: {
      totalChecks: checks.length,
      failureClassCounts,
      warnings: Number(ledger?.aggregate?.counts?.warning || 0),
      failed: Number(ledger?.aggregate?.counts?.failed || 0),
      pending: Number(ledger?.aggregate?.counts?.queued || 0)
        + Number(ledger?.aggregate?.counts?.running || 0),
      unknown: Number(ledger?.aggregate?.counts?.unknown || 0),
    },
    failures,
    nonBlockingSignals,
  };
}

export function writeOperatorTruthSummary({
  ledgerPath = 'artifacts/control-room-test-ledger.json',
  runtimeWitnessPath = '',
  outputPath = 'artifacts/operator-truth-summary.json',
} = {}) {
  const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  const runtimeWitness = runtimeWitnessPath && fs.existsSync(runtimeWitnessPath)
    ? JSON.parse(fs.readFileSync(runtimeWitnessPath, 'utf8'))
    : null;
  const summary = buildOperatorTruthSummary({ ledger, runtimeWitness });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
  return summary;
}

const isDirectExecution = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) writeOperatorTruthSummary();
