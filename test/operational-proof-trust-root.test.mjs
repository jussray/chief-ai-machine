import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/operational-proof-contract.yml', import.meta.url),
  'utf8',
);

describe('Operational Proof source-only trust boundary', () => {
  it('never grants candidate-controlled Actions check-read authority', () => {
    expect(workflow).not.toContain('checks: read');
    expect(workflow).not.toContain('GITHUB_TOKEN: ${{ github.token }}');
    expect(workflow).not.toContain('verify-candidate-producer-evidence.mjs');
    expect(workflow).not.toContain('verify-proofmode-ruleset.mjs');
  });

  it('never emits the legacy operational authority context from GitHub Actions', () => {
    expect(workflow).not.toContain('name: Verify operational authority');
    expect(workflow).toContain('name: Verify operational source contract');
  });

  it('does not pretend a pull_request_target trust root can bootstrap from this PR', () => {
    expect(workflow).not.toContain('pull_request_target:');
    expect(workflow).not.toContain('TRUSTED_BASE_SHA:');
    expect(workflow).not.toContain('authority-observation:');
  });

  it('keeps exact-head source verification and immutable checkout hygiene', () => {
    expect(workflow).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || github.sha }}');
    expect(workflow).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('test "$(git rev-parse HEAD)" = "$EXPECTED_HEAD_SHA"');
    expect(workflow).toContain('node scripts/verify-operational-authority.mjs');
  });
});
