import { describe, expect, it } from 'vitest';
import {
  aggregateTestLedger,
  buildTestLedger,
  mapCheckState,
  selectLatestChecks,
} from '../scripts/control-room-test-ledger.mjs';

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
});
