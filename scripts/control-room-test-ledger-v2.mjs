import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  aggregateTestLedger,
  selectLatestChecks,
} from './control-room-test-ledger.mjs';

const CANONICAL_MANIFEST_PATH = '.control-room/repository.manifest.json';
const ALLOWED_REQUIREMENTS = new Set(['always', 'when-present', 'observer', 'not-observed']);
const ALLOWED_EVENTS = new Set(['push', 'pull_request']);
const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeSha = (value) => clean(value).toLowerCase();
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function signalKey(signal) {
  return `${clean(signal?.ledger?.app)}\u0000${clean(signal?.name)}`;
}

function checkKey(check) {
  return `${clean(check?.app)}\u0000${clean(check?.name)}`;
}

export function loadCanonicalLedgerPolicy(policyPath = CANONICAL_MANIFEST_PATH) {
  const manifest = JSON.parse(fs.readFileSync(policyPath, 'utf8'));
  const signals = Array.isArray(manifest?.verification?.requiredSignals)
    ? manifest.verification.requiredSignals
    : [];
  const errors = [];

  if (manifest?.repository?.identifier !== 'jussray/chief-ai-machine') {
    errors.push('canonical repository manifest identifier is unexpected');
  }
  if (signals.length === 0) errors.push('canonical repository manifest has no requiredSignals');

  const ids = new Set();
  const keys = new Set();
  const normalizedSignals = signals.map((signal, index) => {
    const id = clean(signal?.id);
    const name = clean(signal?.name);
    const app = clean(signal?.ledger?.app);
    const requirement = clean(signal?.ledger?.requirement);
    const events = Array.isArray(signal?.ledger?.events)
      ? [...new Set(signal.ledger.events.map(clean).filter(Boolean))]
      : [];

    if (!id) errors.push(`requiredSignals[${index}].id is required`);
    if (ids.has(id)) errors.push(`duplicate canonical signal id: ${id}`);
    ids.add(id);
    if (!name) errors.push(`canonical signal name missing: ${id || index}`);
    if (signal?.required !== true) errors.push(`canonical signal must remain required: ${id || index}`);
    if (!app) errors.push(`canonical ledger app missing: ${id || index}`);
    if (!ALLOWED_REQUIREMENTS.has(requirement)) {
      errors.push(`canonical ledger requirement invalid: ${id || index}`);
    }
    if (events.some((event) => !ALLOWED_EVENTS.has(event))) {
      errors.push(`canonical ledger event invalid: ${id || index}`);
    }
    if (requirement === 'not-observed' && events.length !== 0) {
      errors.push(`not-observed signal may not declare ledger events: ${id || index}`);
    }
    if (requirement !== 'not-observed' && events.length === 0) {
      errors.push(`observed signal must declare at least one ledger event: ${id || index}`);
    }

    const normalized = { id, name, required: true, ledger: { app, requirement, events } };
    if (requirement !== 'not-observed') {
      const key = signalKey(normalized);
      if (keys.has(key)) errors.push(`duplicate canonical ledger app/name authority: ${app}/${name}`);
      keys.add(key);
    }
    return normalized;
  });

  if (errors.length > 0) {
    throw new Error(`Canonical ledger policy invalid: ${errors.join('; ')}`);
  }
  return { policyPath, signals: normalizedSignals };
}

export function signalsForEvent(signals, eventName) {
  const event = clean(eventName);
  if (!ALLOWED_EVENTS.has(event)) throw new Error(`Unsupported ledger policy event: ${event || 'missing'}`);
  return (Array.isArray(signals) ? signals : []).filter(
    (signal) => signal.ledger.requirement !== 'not-observed' && signal.ledger.events.includes(event),
  );
}

export function classifyChecks(checks, signals, eventName) {
  const applicable = signalsForEvent(signals, eventName);
  const byKey = new Map(applicable.map((signal) => [signalKey(signal), signal]));
  return (Array.isArray(checks) ? checks : []).map((check) => {
    const signal = byKey.get(checkKey(check));
    const requirement = signal?.ledger?.requirement ?? 'advisory';
    return {
      ...check,
      authority: requirement === 'always' || requirement === 'when-present' ? 'required' : 'advisory',
      authoritySignalId: signal?.id ?? null,
      authorityRequirement: signal?.ledger?.requirement ?? null,
    };
  });
}

export function buildPolicyLedger({
  repository,
  sha,
  branch,
  runId,
  checks,
  signals,
  policyEvent,
  observerState,
  observedAt = new Date(),
  policyPath = CANONICAL_MANIFEST_PATH,
}) {
  const applicable = signalsForEvent(signals, policyEvent);
  const observerSignals = applicable.filter((signal) => signal.ledger.requirement === 'observer');
  const classified = classifyChecks(checks, signals, policyEvent);
  const authoritativeChecks = classified.filter((check) => check.authority === 'required');
  const discoveredKeys = new Set(classified.map(checkKey));
  const missingAlwaysSignals = applicable
    .filter((signal) => signal.ledger.requirement === 'always')
    .filter((signal) => !discoveredKeys.has(signalKey(signal)))
    .map((signal) => ({ id: signal.id, name: signal.name, app: signal.ledger.app }));

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
      requiredCheckAuthority: 'canonical-repository-manifest',
      policyPath,
      policyEvent,
      authorityTuple: 'event+requirement+app+exact-check-name',
    },
    runner: {
      provider: 'github-actions',
      runId: clean(runId) || null,
      observerState,
      authoritativeForMerge: false,
    },
    aggregate: aggregateTestLedger(authoritativeChecks),
    discoveryAggregate: aggregateTestLedger(classified),
    requiredSignalIds: applicable
      .filter((signal) => signal.ledger.requirement === 'always' || signal.ledger.requirement === 'when-present')
      .map((signal) => signal.id),
    observerSignalIds: observerSignals.map((signal) => signal.id),
    missingAlwaysSignals,
    checks: classified,
  };
}

export function enforcePolicyLedger(ledger, outputPath = 'artifacts/control-room-test-ledger.json') {
  const blockers = [];
  const counts = ledger?.aggregate?.counts || {};
  const missing = Array.isArray(ledger?.missingAlwaysSignals) ? ledger.missingAlwaysSignals : [];
  const failed = Number(counts.failed || 0);
  const pending = Number(counts.queued || 0) + Number(counts.running || 0);
  const unknown = Number(counts.unknown || 0);

  if (missing.length > 0) blockers.push(`missing always-required signals: ${missing.map((signal) => signal.name).join(', ')}`);
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
      'User-Agent': 'control-room-canonical-policy-ledger',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub check lookup failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  }
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
  const policyEvent = clean(env.CONTROL_ROOM_LEDGER_POLICY_EVENT || env.GITHUB_EVENT_NAME || 'push');
  const outputPath = clean(env.CONTROL_ROOM_TEST_LEDGER_PATH) || 'artifacts/control-room-test-ledger.json';
  const timeoutMs = Number(env.CONTROL_ROOM_LEDGER_TIMEOUT_MS || 20 * 60 * 1000);
  const pollMs = Number(env.CONTROL_ROOM_LEDGER_POLL_MS || 10_000);
  const minimumObservationMs = Number(env.CONTROL_ROOM_LEDGER_MINIMUM_MS || 30_000);
  const policyPath = clean(env.CONTROL_ROOM_LEDGER_POLICY_PATH) || CANONICAL_MANIFEST_PATH;
  const { signals } = loadCanonicalLedgerPolicy(policyPath);
  const applicable = signalsForEvent(signals, policyEvent);
  const observers = applicable.filter((signal) => signal.ledger.requirement === 'observer');

  if (!repository || !sha || !token) {
    throw new Error('GITHUB_REPOSITORY, EXPECTED_HEAD_SHA/GITHUB_SHA, and GITHUB_TOKEN are required.');
  }
  if (observers.length !== 1) {
    throw new Error(`Canonical ledger policy must define exactly one observer for ${policyEvent}; found ${observers.length}`);
  }
  const observerCheckName = observers[0].name;
  const configuredObserver = clean(env.CONTROL_ROOM_LEDGER_SELF_CHECK);
  if (configuredObserver && configuredObserver !== observerCheckName) {
    throw new Error(`Configured observer check does not match canonical authority: ${configuredObserver} != ${observerCheckName}`);
  }

  const startedAt = Date.now();
  let stableTerminalPolls = 0;
  let previousFingerprint = '';
  let checks = [];
  let reachedStableTerminal = false;

  while (Date.now() - startedAt < timeoutMs) {
    checks = selectLatestChecks(
      await fetchAllCheckRuns({ repository, sha, token }),
      sha,
      observerCheckName,
    );
    const snapshot = buildPolicyLedger({
      repository,
      sha,
      branch,
      runId,
      checks,
      signals,
      policyEvent,
      observerState: 'observing',
      policyPath,
    });
    writeLedger(outputPath, snapshot);
    const authoritative = snapshot.checks.filter((check) => check.authority === 'required');
    const fingerprint = JSON.stringify(authoritative.map((check) => [check.app, check.name, check.state]));
    const terminal = snapshot.missingAlwaysSignals.length === 0
      && !authoritative.some((check) => check.state === 'queued' || check.state === 'running');
    const oldEnough = Date.now() - startedAt >= minimumObservationMs;
    stableTerminalPolls = terminal && oldEnough && fingerprint === previousFingerprint
      ? stableTerminalPolls + 1
      : 0;
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
    signals,
    policyEvent,
    observerState: reachedStableTerminal ? 'stable' : 'window-expired',
    policyPath,
  });
  writeLedger(outputPath, ledger);
  console.log(JSON.stringify(ledger, null, 2));
  return enforcePolicyLedger(ledger, outputPath);
}

const isDirectExecution = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  observePolicyChecks().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
