import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new globalThis.URL('../.github/workflows/control-room-test-ledger.yml', import.meta.url),
  'utf8',
);
const observer = readFileSync(
  new globalThis.URL('../scripts/control-room-test-ledger-v2.mjs', import.meta.url),
  'utf8',
);

describe('Control Room exact-head ledger workflow', () => {
  it('materializes the required publish context on pull requests', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('name: Publish exact-head test ledger');
    expect(workflow).not.toContain("if: github.event_name != 'pull_request'");
    expect(workflow).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}');
  });

  it('keeps the pull-request observer read-only and excludes its own required context', () => {
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('checks: read');
    expect(workflow).not.toContain('contents: write');
    expect(workflow).not.toContain('checks: write');
    expect(observer).toContain("CONTROL_ROOM_LEDGER_SELF_CHECK || 'Publish exact-head test ledger'");
    expect(observer).toContain('selectLatestChecks(await fetchAllCheckRuns({ repository, sha, token }), sha, observerCheckName)');
    expect(observer).toContain('excludesObserverCheck: true');
  });
});
