import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/operational-proof-contract.yml', import.meta.url),
  'utf8',
);

function section(startMarker, endMarker) {
  const start = workflow.indexOf(startMarker);
  const end = endMarker ? workflow.indexOf(endMarker, start + startMarker.length) : workflow.length;
  expect(start).toBeGreaterThanOrEqual(0);
  if (endMarker) expect(end).toBeGreaterThan(start);
  return workflow.slice(start, end);
}

describe('Operational Proof trusted producer authority boundary', () => {
  it('keeps check-read authority out of workflow-global and PR-head source scope', () => {
    const jobsStart = workflow.indexOf('jobs:');
    expect(jobsStart).toBeGreaterThanOrEqual(0);
    expect(workflow.slice(0, jobsStart)).not.toContain('checks: read');

    const source = section('  source-contract:', '  authority-observation:');
    expect(source).toContain('name: Verify operational source contract');
    expect(source).toContain("if: ${{ github.event_name != 'pull_request_target' }}");
    expect(source).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(source).not.toContain('checks: read');
    expect(source).not.toContain('verify-candidate-producer-evidence.mjs');
  });

  it('uses pull_request_target only for trusted-base observation, never an Actions authority context', () => {
    expect(workflow).toContain('pull_request_target:');
    expect(workflow).not.toContain('name: Verify operational authority');

    const observation = section('  authority-observation:');
    expect(observation).toContain('name: Observe operational authority from trusted base');
    expect(observation).toContain("if: ${{ github.event_name == 'pull_request_target' }}");
    expect(observation).toContain('checks: read');
    expect(observation).toContain('TRUSTED_BASE_SHA: ${{ github.event.pull_request.base.sha }}');
    expect(observation).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha }}');
    expect(observation).toContain('ref: ${{ env.TRUSTED_BASE_SHA }}');
    expect(observation).not.toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(observation).toContain('test "$trusted" = "$TRUSTED_BASE_SHA"');
    expect(observation).toContain('test "$trusted" != "$EXPECTED_HEAD_SHA"');
    expect(observation).toContain('node scripts/verify-candidate-producer-evidence.mjs');
  });

  it('does not let source and trusted observation runs cancel one another', () => {
    expect(workflow).toContain(
      'group: operational-proof-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}',
    );
  });
});
