import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function run(diff) {
  const result = spawnSync('python3', ['scripts/independent_review.py'], {
    input: diff,
    encoding: 'utf8',
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `python exited ${result.status}`);
  return JSON.parse(result.stdout);
}

describe('Python independent reviewer', () => {
  it('emits deterministic non-authorizing findings for risky additions', () => {
    const output = run([
      'diff --git a/scripts/demo.py b/scripts/demo.py',
      '--- a/scripts/demo.py',
      '+++ b/scripts/demo.py',
      '@@ -1,1 +1,2 @@',
      ' import subprocess',
      '+subprocess.run(user_command, shell=True)',
    ].join('\n'));

    expect(output.ok).toBe(true);
    expect(output.reviewer.kind).toBe('deterministic');
    expect(output.reviewer.provider).toBe('python');
    expect(output.semanticReviewSatisfied).toBe(false);
    expect(output.mergeAuthorized).toBe(false);
    expect(output.executionAuthorized).toBe(false);
    expect(output.findings.some((finding) => finding.id.includes('python-shell-true'))).toBe(true);
  });

  it('does not invent a semantic clearance for a clean diff', () => {
    const output = run([
      'diff --git a/src/safe.js b/src/safe.js',
      '--- a/src/safe.js',
      '+++ b/src/safe.js',
      '@@ -1,1 +1,1 @@',
      '+export const safe = true;',
    ].join('\n'));
    expect(output.findings).toEqual([]);
    expect(output.semanticReviewSatisfied).toBe(false);
  });
});
