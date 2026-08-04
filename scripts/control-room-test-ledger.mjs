import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const CONTROL_ROOM_TEST_LEDGER_SCHEMA_VERSION = 1;
const FAILURE_CONCLUSIONS = new Set(['action_required', 'cancelled', 'failure', 'startup_failure', 'stale', 'timed_out']);
const clean = (value) => typeof value === 'string' ? value.trim() : '';
const normalizeSha = (value) => clean(value).toLowerCase();
const timestamp = (value) => Number.isFinite(Date.parse(value ?? '')) ? Date.parse(value ?? '') : 0;
const checkKey = (run) => `${clean(run?.app?.slug) || clean(run?.app?.name) || 'unknown-app'}\u0000${clean(run?.name)}`;

export function mapCheckState(run) {
  const status = clean(run?.status);
  const conclusion = clean(run?.conclusion);
  if (['queued', 'requested', 'waiting'].includes(status)) return 'queued';
  if (['in_progress', 'pending'].includes(status)) return 'running';
  if (status !== 'completed') return 'unknown';
  if (conclusion === 'success') return 'passed';
  if (conclusion === 'neutral' || conclusion === 'skipped') return 'skipped';
  if (FAILURE_CONCLUSIONS.has(conclusion)) return 'failed';
  return 'unknown';
}

export function selectLatestChecks(checkRuns, expectedSha, observerCheckName = '') {
  const exactSha = normalizeSha(expectedSha);
  const selected = new Map();
  for (const run of Array.isArray(checkRuns) ? checkRuns : []) {
    if (!run || normalizeSha(run.head_sha) !== exactSha || !clean(run.name)) continue;
    if (observerCheckName && clean(run.name) === observerCheckName) continue;
    const key = checkKey(run);
    const current = selected.get(key);
    if (!current || timestamp(run.completed_at ?? run.started_at) >= timestamp(current.completed_at ?? current.started_at)) selected.set(key, run);
  }
  return [...selected.values()].map((run) => ({
    id: String(run.id ?? ''),
    name: clean(run.name),
    app: clean(run?.app?.slug) || clean(run?.app?.name) || 'unknown-app',
    state: mapCheckState(run),
    status: clean(run.status) || 'unknown',
    conclusion: clean(run.conclusion) || null,
    headSha: normalizeSha(run.head_sha),
    startedAt: clean(run.started_at) || null,
    completedAt: clean(run.completed_at) || null,
    detailsUrl: clean(run.details_url) || clean(run.html_url) || null,
    externalId: clean(run.external_id) || null,
  })).sort((left, right) => left.name.localeCompare(right.name) || left.app.localeCompare(right.app));
}

export function aggregateTestLedger(checks) {
  const list = Array.isArray(checks) ? checks : [];
  const counts = {
    total: list.length,
    passed: list.filter((check) => check.state === 'passed').length,
    failed: list.filter((check) => check.state === 'failed').length,
    queued: list.filter((check) => check.state === 'queued').length,
    running: list.filter((check) => check.state === 'running').length,
    skipped: list.filter((check) => check.state === 'skipped').length,
    unknown: list.filter((check) => check.state === 'unknown').length,
  };
  let state = 'passed';
  if (counts.total === 0) state = 'unknown';
  else if (counts.failed > 0) state = 'failed';
  else if (counts.queued > 0 || counts.running > 0) state = 'pending';
  else if (counts.skipped > 0 || counts.unknown > 0) state = 'warning';
  return {state, counts};
}

export function buildTestLedger({repository, sha, branch, runId, checks, observerState = 'observing', observedAt = new Date()}) {
  return {
    schemaVersion: CONTROL_ROOM_TEST_LEDGER_SCHEMA_VERSION,
    repository,
    commitSha: normalizeSha(sha),
    branch: clean(branch) || null,
    generatedAt: observedAt.toISOString(),
    source: {provider: 'github-check-runs', exactRef: 'commit-sha', dedupe: 'latest-by-app-and-name', includesAllDiscoveredChecks: true, excludesObserverCheck: true},
    runner: {provider: 'github-actions', runId: clean(runId) || null, observerState, authoritativeForMerge: false},
    aggregate: aggregateTestLedger(checks),
    checks,
  };
}

async function githubJson(url, token) {
  const response = await fetch(url, {headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'control-room-test-ledger', 'X-GitHub-Api-Version': '2022-11-28'}});
  if (!response.ok) throw new Error(`GitHub check lookup failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

async function fetchAllCheckRuns({repository, sha, token}) {
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

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
function writeLedger(outputPath, ledger) {
  fs.mkdirSync(path.dirname(outputPath), {recursive: true});
  fs.writeFileSync(outputPath, `${JSON.stringify(ledger, null, 2)}\n`, 'utf8');
}

export async function observeExactHeadChecks(env = process.env) {
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
  if (!repository || !sha || !token) throw new Error('GITHUB_REPOSITORY, EXPECTED_HEAD_SHA/GITHUB_SHA, and GITHUB_TOKEN are required.');

  const startedAt = Date.now();
  let stableTerminalPolls = 0;
  let previousFingerprint = '';
  let checks = [];
  let reachedStableTerminal = false;
  while (Date.now() - startedAt < timeoutMs) {
    checks = selectLatestChecks(await fetchAllCheckRuns({repository, sha, token}), sha, observerCheckName);
    writeLedger(outputPath, buildTestLedger({repository, sha, branch, runId, checks}));
    const fingerprint = JSON.stringify(checks.map((check) => [check.app, check.name, check.state]));
    const terminal = !checks.some((check) => check.state === 'queued' || check.state === 'running');
    const oldEnough = Date.now() - startedAt >= minimumObservationMs;
    stableTerminalPolls = terminal && oldEnough && fingerprint === previousFingerprint ? stableTerminalPolls + 1 : 0;
    previousFingerprint = fingerprint;
    if (stableTerminalPolls >= 1) { reachedStableTerminal = true; break; }
    await sleep(pollMs);
  }

  const ledger = buildTestLedger({repository, sha, branch, runId, checks, observerState: reachedStableTerminal ? 'stable' : 'window-expired'});
  writeLedger(outputPath, ledger);
  if (ledger.aggregate.counts.total === 0) throw new Error(`No exact-head checks were discovered. Evidence: ${outputPath}`);
  console.log(JSON.stringify(ledger, null, 2));
  return ledger;
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) observeExactHeadChecks().catch((error) => { console.error(error instanceof Error ? error.stack ?? error.message : String(error)); process.exit(1); });
