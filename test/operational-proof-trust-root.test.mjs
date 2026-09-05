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

    const source = section('  source-contract:', '  authority:');
    expect(source).toContain('name: Verify operational source contract');
    expect(source).toContain("if: ${{ github.event_name != 'pull_request_target' }}");
    expect(source).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(source).not.toContain('checks: read');
    expect(source).not.toContain('verify-candidate-producer-evidence.mjs');
    expect(source).not.toContain('name: Verify operational authority');
  });

  it('emits operational authority only from a trusted-base pull_request_target job', () => {
    expect(workflow).toContain('pull_request_target:');
    const authority = section('  authority:');
    expect(authority).toContain('name: Verify operational authority');
    expect(authority).toContain("if: ${{ github.event_name == 'pull_request_target' }}");
    expect(authority).toContain('checks: read');
    expect(authority).toContain('TRUSTED_BASE_SHA: ${{ github.event.pull_request.base.sha }}');
    expect(authority).toContain('EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha }}');
    expect(authority).toContain('ref: ${{ env.TRUSTED_BASE_SHA }}');
    expect(authority).not.toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(authority).toContain('test "$trusted" = "$TRUSTED_BASE_SHA"');
    expect(authority).toContain('test "$trusted" != "$EXPECTED_HEAD_SHA"');
    expect(authority).toContain('node scripts/verify-candidate-producer-evidence.mjs');
  });

  it('does not let source and trusted authority runs cancel one another', () => {
    expect(workflow).toContain(
      'group: operational-proof-${{ github.event_name }}-${{ github.event.pull_request.number || github.ref }}',
    );
  });
});
