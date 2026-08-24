// @ts-nocheck
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflow = await readFile('.github/workflows/merge-intent-gate.yml', 'utf8');

describe('merge intent workflow authority', () => {
  it('evaluates stale pull requests using the current trusted base branch tip', () => {
    expect(workflow).toContain("pull_request_target:");
    expect(workflow).toContain("ref: ${{ github.event.pull_request.base.ref }}");
    expect(workflow).not.toContain("ref: ${{ github.event.pull_request.base.sha }}");
    expect(workflow).toContain('test -f src/domain/merge-intent.js');
  });

  it('keeps pull-request content untrusted while only reading merge intent metadata', () => {
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('PR_TITLE: ${{ github.event.pull_request.title }}');
    expect(workflow).toContain('PR_BODY: ${{ github.event.pull_request.body }}');
    expect(workflow).toContain("import { evaluateMergeIntent } from './src/domain/merge-intent.js';");
  });
});
