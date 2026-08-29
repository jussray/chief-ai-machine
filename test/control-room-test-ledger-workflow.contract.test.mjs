import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflow = await readFile('.github/workflows/control-room-test-ledger.yml', 'utf8');
const manifest = JSON.parse(await readFile('.control-room/test-ledger.manifest.json', 'utf8'));

describe('Control Room Test Ledger workflow contract', () => {
  it('materializes the ruleset-required ledger check on pull requests', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('name: Publish exact-head test ledger');
    expect(workflow).not.toContain("if: github.event_name != 'pull_request'");
  });

  it('keeps the observer outside the authority set to avoid self-authorization', () => {
    expect(manifest.source.excludeObserverCheck).toBe(true);
    expect(manifest.policy.requiredChecks).not.toContain('Publish exact-head test ledger');
    expect(manifest.controlRoom.authority).toBe('read-only-test-evidence');
  });
});
