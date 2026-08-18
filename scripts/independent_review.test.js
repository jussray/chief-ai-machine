import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

function runRaw(diff) {
  const result = spawnSync('python3', ['scripts/independent_review.py'], {
    input: diff,
    encoding: 'utf8',
  });
  return { ...result, json: JSON.parse(result.stdout) };
}

function run(diff) {
  const result = runRaw(diff);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `python exited ${result.status}`);
  return result.json;
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

  it('does not echo a detected secret literal into review output', () => {
    const secret = 'super-secret-value-12345';
    const output = run([
      'diff --git a/src/config.js b/src/config.js',
      '--- a/src/config.js',
      '+++ b/src/config.js',
      '@@ -1,0 +1,1 @@',
      `+const apiKey = "${secret}";`,
    ].join('\n'));

    expect(output.findings.some((finding) => finding.id.includes('secret-literal'))).toBe(true);
    expect(JSON.stringify(output)).not.toContain(secret);
    expect(output.findings[0].evidence).toMatch(/line_sha256_prefix=/);
  });

  it('fails closed instead of truncating more than 100 findings', () => {
    const additions = Array.from({ length: 101 }, (_, index) => `+subprocess.run(command_${index}, shell=True)`);
    const result = runRaw([
      'diff --git a/scripts/many.py b/scripts/many.py',
      '--- a/scripts/many.py',
      '+++ b/scripts/many.py',
      '@@ -0,0 +1,101 @@',
      ...additions,
    ].join('\n'));

    expect(result.status).toBe(2);
    expect(result.json.ok).toBe(false);
    expect(result.json.error).toMatch(/exceed 100/);
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
