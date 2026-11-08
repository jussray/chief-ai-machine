import { describe, expect, it } from 'vitest';
import {
  aggregateTestLedger,
  buildTestLedger,
  enforceTestLedgerPolicy,
  mapCheckState,
  selectLatestChecks,
} from '../scripts/control-room-test-ledger.mjs';
import {
  buildPolicyLedger,
  classifyChecks,
  enforcePolicyLedger,
  loadCanonicalLedgerPolicy,
  signalsForEvent,
} from '../scripts/control-room-test-ledger-v2.mjs';

const SHA = '79b4f386f362087c9c965560fc906edc226cf6f7';
const run = (overrides = {}) => ({
  id: 1,
  name: 'Quality Gate',
  status: 'completed',
  conclusion: 'success',
  head_sha: SHA,
  started_at: '2026-08-05T20:00:00Z',
  completed_at: '2026-08-05T20:01:00Z',
  details_url: 'https://github.com/jussray/chief-ai-machine/actions/runs/1',
  app: { slug: 'github-actions' },
  ...overrides,
});

const policyLedger = (states, observerState = 'stable') => buildTestLedger({
  repository: 'jussray/chief-ai-machine',
  sha: SHA,
  branch: 'main',
  runId: '1',
  checks: states.map((state) => ({ state })),
  observerState,
});

function canonicalPushFixture() {
  const { signals } = loadCanonicalLedgerPolicy();
  const pushSignals = signalsForEvent(signals, 'push');
  const always = pushSignals.filter((signal) => signal.ledger.requirement === 'always');
  return {
    signals,
    checks: always.map((signal, index) => ({
      id: String(index + 1),
      name: signal.name,
      app: signal.ledger.app,
      state: 'passed',
      status: 'completed',
      conclusion: 'success',
      headSha: SHA,
    })),
  };
}

describe('Control Room exact-head test ledger', () => {
  it('maps check states without false green', () => {
    expect(mapCheckState(run())).toBe('passed');
    expect(mapCheckState(run({ conclusion: 'neutral' }))).toBe('skipped');
    expect(mapCheckState(run({ conclusion: 'failure' }))).toBe('failed');
    expect(mapCheckState(run({ status: 'in_progress', conclusion: null }))).toBe('running');
    expect(mapCheckState(run({ status: 'completed', conclusion: null }))).toBe('unknown');
  });

  it('keeps every latest exact-head lane', () => {
    const checks = selectLatestChecks(
      [
        run({ id: 1, completed_at: '2026-08-05T20:01:00Z' }),
        run({ id: 2, conclusion: 'failure', completed_at: '2026-08-05T20:02:00Z' }),
        run({ id: 3, name: 'Freestyle Save Playwright' }),
        run({ id: 4, name: 'Cloudflare Pages', app: { slug: 'cloudflare-pages' } }),
        run({ id: 5, name: 'Publish exact-head test ledger' }),
      ],
      SHA,
      'Publish exact-head test ledger',
    );

    expect(checks.map((item) => item.name)).toEqual([
      'Cloudflare Pages',
      'Freestyle Save Playwright',
      'Quality Gate',
    ]);
    expect(checks.find((item) => item.name === 'Quality Gate')?.state).toBe('failed');
  });

  it('preserves distinct aggregate states', () => {
    expect(aggregateTestLedger([]).state).toBe('unknown');
    expect(aggregateTestLedger([{ state: 'passed' }]).state).toBe('passed');
    expect(aggregateTestLedger([{ state: 'skipped' }]).state).toBe('warning');
    expect(aggregateTestLedger([{ state: 'queued' }]).state).toBe('pending');
    expect(aggregateTestLedger([{ state: 'failed' }]).state).toBe('failed');
  });

  it('builds sanitized exact-SHA evidence', () => {
    const ledger = buildTestLedger({
      repository: 'jussray/chief-ai-machine',
      sha: SHA,
      branch: 'main',
      runId: '1',
      checks: selectLatestChecks([run()], SHA),
    });
    expect(ledger.commitSha).toBe(SHA);
    expect(ledger.source.includesAllDiscoveredChecks).toBe(true);
    expect(JSON.stringify(ledger)).not.toContain('token');
  });

  it('fails closed on blocked evidence while allowing skipped warnings', () => {
    const evidencePath = 'artifacts/control-room-test-ledger.json';
    expect(() => enforceTestLedgerPolicy(policyLedger(['passed']), evidencePath)).not.toThrow();
    expect(() => enforceTestLedgerPolicy(policyLedger(['passed', 'skipped']), evidencePath)).not.toThrow();
    expect(() => enforceTestLedgerPolicy(policyLedger([]), evidencePath)).toThrow(/no exact-head checks were discovered/);
    expect(() => enforceTestLedgerPolicy(policyLedger(['failed']), evidencePath)).toThrow(/1 failed check/);
    expect(() => enforceTestLedgerPolicy(policyLedger(['queued', 'running']), evidencePath)).toThrow(/2 pending checks/);
    expect(() => enforceTestLedgerPolicy(policyLedger(['unknown']), evidencePath)).toThrow(/1 unknown check/);
    expect(() => enforceTestLedgerPolicy(policyLedger(['passed'], 'window-expired'), evidencePath)).toThrow(/did not reach a stable terminal state/);
  });
});

describe('Canonical repository-authority ledger v2', () => {
  it('loads one canonical authority source with current check names and event applicability', () => {
    const { policyPath, signals } = loadCanonicalLedgerPolicy();
    expect(policyPath).toBe('.control-room/repository.manifest.json');
    expect(signals.find((signal) => signal.id === 'operational-authority')?.name).toBe('Verify operational authority');
    expect(signals.find((signal) => signal.id === 'freestyle-save-playwright')?.name).toBe('Verify Freestyle, Goalfix, and PromptOS in Chromium');
    expect(signals.find((signal) => signal.id === 'freestyle-save-playwright')?.ledger.requirement).toBe('not-observed');
    expect(signals.filter((signal) => signal.ledger.requirement === 'observer')).toEqual([
      expect.objectContaining({ id: 'test-ledger-publish', name: 'Publish exact-head test ledger' }),
    ]);
  });

  it('requires only always-on push signals when path-scoped checks are absent', () => {
    const { signals, checks } = canonicalPushFixture();
    const ledger = buildPolicyLedger({
      repository: 'jussray/chief-ai-machine',
      sha: SHA,
      branch: 'main',
      runId: '1',
      checks,
      signals,
      policyEvent: 'push',
      observerState: 'stable',
    });
    expect(ledger.missingAlwaysSignals).toEqual([]);
    expect(ledger.requiredSignalIds).toContain('control-room-contracts');
    expect(ledger.checks.some((check) => check.authoritySignalId === 'control-room-contracts')).toBe(false);
    expect(() => enforcePolicyLedger(ledger)).not.toThrow();
  });

  it('makes a path-scoped canonical check authoritative when it is present', () => {
    const { signals, checks } = canonicalPushFixture();
    checks.push({
      id: '99',
      name: 'Verify Chief AI control room contracts',
      app: 'github-actions',
      state: 'failed',
      status: 'completed',
      conclusion: 'failure',
      headSha: SHA,
    });
    const ledger = buildPolicyLedger({
      repository: 'jussray/chief-ai-machine',
      sha: SHA,
      branch: 'main',
      runId: '1',
      checks,
      signals,
      policyEvent: 'push',
      observerState: 'stable',
    });
    expect(ledger.checks.find((check) => check.name === 'Verify Chief AI control room contracts')?.authority).toBe('required');
    expect(() => enforcePolicyLedger(ledger)).toThrow(/1 failed required check/);
  });

  it('keeps SonarQube and provider checks visible without silently granting authority', () => {
    const { signals, checks } = canonicalPushFixture();
    checks.push(
      { id: '90', name: 'SonarQube – Founder Intelligence', app: 'github-actions', state: 'queued' },
      { id: '91', name: 'Workers Builds: chief-ai', app: 'cloudflare-workers-and-pages', state: 'passed' },
    );
    const classified = classifyChecks(checks, signals, 'push');
    expect(classified.find((check) => check.name === 'SonarQube – Founder Intelligence')?.authority).toBe('advisory');
    expect(classified.find((check) => check.name === 'Workers Builds: chief-ai')?.authority).toBe('advisory');

    const ledger = buildPolicyLedger({
      repository: 'jussray/chief-ai-machine',
      sha: SHA,
      branch: 'main',
      runId: '1',
      checks,
      signals,
      policyEvent: 'push',
      observerState: 'stable',
    });
    expect(ledger.aggregate.state).toBe('passed');
    expect(ledger.discoveryAggregate.state).toBe('pending');
    expect(() => enforcePolicyLedger(ledger)).not.toThrow();
  });

  it('does not let another app spoof an authoritative check name', () => {
    const { signals, checks } = canonicalPushFixture();
    const withoutUnit = checks.filter((check) => check.name !== 'Unit Tests');
    withoutUnit.push({ id: 'evil', name: 'Unit Tests', app: 'some-external-app', state: 'passed' });
    const ledger = buildPolicyLedger({
      repository: 'jussray/chief-ai-machine',
      sha: SHA,
      branch: 'main',
      runId: '1',
      checks: withoutUnit,
      signals,
      policyEvent: 'push',
      observerState: 'stable',
    });
    expect(ledger.checks.find((check) => check.app === 'some-external-app')?.authority).toBe('advisory');
    expect(ledger.missingAlwaysSignals).toEqual([
      expect.objectContaining({ id: 'unit-tests', name: 'Unit Tests', app: 'github-actions' }),
    ]);
    expect(() => enforcePolicyLedger(ledger)).toThrow(/missing always-required signals: Unit Tests/);
  });

  it('fails closed when an always-required canonical signal is missing or pending', () => {
    const { signals, checks } = canonicalPushFixture();
    const missingOperational = checks.filter((check) => check.name !== 'Verify operational authority');
    const missingLedger = buildPolicyLedger({
      repository: 'jussray/chief-ai-machine',
      sha: SHA,
      branch: 'main',
      runId: '1',
      checks: missingOperational,
      signals,
      policyEvent: 'push',
      observerState: 'window-expired',
    });
    expect(() => enforcePolicyLedger(missingLedger)).toThrow(/missing always-required signals: Verify operational authority/);

    const pendingChecks = checks.map((check) => check.name === 'Unit Tests' ? { ...check, state: 'queued' } : check);
    const pendingLedger = buildPolicyLedger({
      repository: 'jussray/chief-ai-machine',
      sha: SHA,
      branch: 'main',
      runId: '1',
      checks: pendingChecks,
      signals,
      policyEvent: 'push',
      observerState: 'window-expired',
    });
    expect(() => enforcePolicyLedger(pendingLedger)).toThrow(/1 pending required check/);
  });

  it('keeps the observer recursive check out of the blocking aggregate', () => {
    const { signals, checks } = canonicalPushFixture();
    const pushSignals = signalsForEvent(signals, 'push');
    expect(pushSignals.find((signal) => signal.id === 'test-ledger-publish')?.ledger.requirement).toBe('observer');
    const ledger = buildPolicyLedger({
      repository: 'jussray/chief-ai-machine',
      sha: SHA,
      branch: 'main',
      runId: '1',
      checks,
      signals,
      policyEvent: 'push',
      observerState: 'stable',
    });
    expect(ledger.observerSignalIds).toEqual(['test-ledger-publish']);
    expect(ledger.requiredSignalIds).not.toContain('test-ledger-publish');
  });
});
