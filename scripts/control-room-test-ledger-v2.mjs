import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateTestLedger,
  selectLatestChecks,
} from './control-room-test-ledger.mjs';

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeSha = (value) => clean(value).toLowerCase();
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function loadLedgerPolicy(policyPath = '.control-room/test-ledger.manifest.json') {
  const manifest = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  const requiredChecks = Array.isArray(manifest?.policy?.requiredChecks)
    ? manifest.policy.requiredChecks.map(clean).filter(Boolean)
    : [];
  if (requiredChecks.length === 0) {
    throw new Error(`Test-ledger policy has no requiredChecks: ${policyPath}`);
  }
  return { policyPath, requiredChecks };
}

export function classifyChecks(checks, requiredNames) {
  const required = new Set(requiredNames);
  return (Array.isArray(checks) ? checks : []).map((check) => ({
    ...check,
    authority: required.has(check.name) ? 'required' : 'advisory',
  }));
}

export function buildPolicyLedger({ repository, sha, branch, runId, checks, requiredNames, observerState, observedAt = new Date(), policyPath }) {
  const classified = classifyChecks(checks, requiredNames);
  const authoritativeChecks = classified.filter((check) => check.authority === 'required');
  const discoveredRequiredNames = new Set(authoritativeChecks.map((check) => check.name));
  const missingRequiredChecks = requiredNames.filter((name) => !discoveredRequiredNames.has(name));
  return {
    schemaVersion: 2,
    repository,
    commitSha: normalizeSha(sha),
    branch: clean(branch) || null,
    generatedAt: observedAt.toISOString(),
    source: {
      provider: 'github-check-runs',
      exactRef: 'commit-sha',
      dedupe: 'latest-by-app-and-name',
      includesAllDiscoveredChecks: true,
      excludesObserverCheck: true,
      requiredCheckAuthority: 'repository-policy',
      policyPath,
    },
    runner: {
      provider: 'github-actions',
      runId: clean(runId) || null,
      observerState,
      authoritativeForMerge: false,
    },
    aggregate: aggregateTestLedger(authoritativeChecks),
    discoveryAggregate: aggregateTestLedger(classified),
    requiredCheckNames: requiredNames,
    missingRequiredChecks,
    checks: classified,
  };
}

export function enforcePolicyLedger(ledger, outputPath = 'artifacts/control-room-test-ledger.json') {
  const blockers = [];
  const counts = ledger?.aggregate?.counts || {};
  const missing = Array.isArray(ledger?.missingRequiredChecks) ? ledger.missingRequiredChecks : [];
  const failed = Number(counts.failed || 0);
  const pending = Number(counts.queued || 0) + Number(counts.running || 0);
  const unknown = Number(counts.unknown || 0);

  if (missing.length > 0) blockers.push(`missing required checks: ${missing.join(', ')}`);
  if (ledger?.runner?.observerState !== 'stable') {
    blockers.push(`observer did not reach a stable terminal state (${ledger?.runner?.observerState || 'unknown'})`);
  }
  if (failed > 0) blockers.push(`${failed} failed required check${failed === 1 ? '' : 's'}`);
  if (pending > 0) blockers.push(`${pending} pending required check${pending === 1 ? '' : 's'}`);
  if (unknown > 0) blockers.push(`${unknown} unknown required check${unknown === 1 ? '' : 's'}`);

  if (blockers.length > 0) {
    throw new Error(`Control Room policy ledger blocked: ${blockers.join('; ')}. Evidence: ${outputPath}`);
  }
  return ledger;
}

async function githubJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'control-room-policy-ledger',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error(`GitHub check lookup failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

async function fetchAllCheckRuns({ repository, sha, token }) {
  const [owner, repo] = clean(repository).split('/');
  if (!owner || !repo) throw new Error('GITHUB_REPOSITORY must use owner/repo format.');
  const runs = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`);
    url.searchParams.set('filter', 'all');
    url.searchParams.set('per_page', '100');
    url.searchParams.set('page', String(page));
    const payload = await githubJson(url, token);
    const pageRuns = Array.isArray(payload?.check_runs) ? payload.check_runs : [];
    runs.push(...pageRuns);
    if (pageRuns.length < 100) break;
  }
  return runs;
}

function writeLedger(outputPath, ledger) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

export async function observePolicyChecks(env = process.env) {
  const repository = clean(env.GITHUB_REPOSITORY);
  const sha = normalizeSha(env.EXPECTED_HEAD_SHA || env.GITHUB_SHA);
  const branch = clean(env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME);
  const token = clean(env.GITHUB_TOKEN);
  const runId = clean(env.GITHUB_RUN_ID);
  const observerCheckName = clean(env.CONTROL_ROOM_LEDGER_SELF_CHECK || 'Publish exact-head test ledger');
  const outputPath = clean(env.CONTROL_ROOM_TEST_LEDGER_PATH) || 'artifacts/control-room-test-ledger.json';
  const timeoutMs = Number(env.CONTROL_ROOM_LEDGER_TIMEOUT_MS || 20 * 60 * 1000);
  const pollMs = Number(env.CONTROL_ROOM_LEDGER_POLL_MS || 10_000);
  const minimumObservationMs = Number(env.CONTROL_ROOM_LEDGER_MINIMUM_MS || 30_000);
  const policyPath = clean(env.CONTROL_ROOM_LEDGER_POLICY_PATH) || '.control-room/test-ledger.manifest.json';
  const { requiredChecks } = loadLedgerPolicy(policyPath);

  if (!repository || !sha || !token) {
    throw new Error('GITHUB_REPOSITORY, EXPECTED_HEAD_SHA/GITHUB_SHA, and GITHUB_TOKEN are required.');
  }

  const startedAt = Date.now();
  let stableTerminalPolls = 0;
  let previousFingerprint = '';
  let checks = [];
  let reachedStableTerminal = false;

  while (Date.now() - startedAt < timeoutMs) {
    checks = selectLatestChecks(await fetchAllCheckRuns({ repository, sha, token }), sha, observerCheckName);
    const snapshot = buildPolicyLedger({ repository, sha, branch, runId, checks, requiredNames: requiredChecks, observerState: 'observing', policyPath });
    writeLedger(outputPath, snapshot);
    const authoritative = snapshot.checks.filter((check) => check.authority === 'required');
    const fingerprint = JSON.stringify(authoritative.map((check) => [check.app, check.name, check.state]));
    const terminal = snapshot.missingRequiredChecks.length === 0 && !authoritative.some((check) => check.state === 'queued' || check.state === 'running');
    const oldEnough = Date.now() - startedAt >= minimumObservationMs;
    stableTerminalPolls = terminal && oldEnough && fingerprint === previousFingerprint ? stableTerminalPolls + 1 : 0;
    previousFingerprint = fingerprint;
    if (stableTerminalPolls >= 1) {
      reachedStableTerminal = true;
      break;
    }
    await sleep(pollMs);
  }

  const ledger = buildPolicyLedger({
    repository,
    sha,
    branch,
    runId,
    checks,
    requiredNames: requiredChecks,
    observerState: reachedStableTerminal ? 'stable' : 'window-expired',
    policyPath,
  });
  writeLedger(outputPath, ledger);
  console.log(JSON.stringify(ledger, null, 2));
  return enforcePolicyLedger(ledger, outputPath);
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  observePolicyChecks().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
