import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/proofmode-mcp-playwright.yml', import.meta.url),
  'utf8',
);

describe('ProofMode exact-head CI GitHub source admission', () => {
  it('grants only read capabilities required for authenticated public evidence', () => {
    const permissions = workflow.match(/^permissions:\n((?: {2}[^\n]+\n)+)/m)?.[1] ?? '';
    expect(permissions).toContain('contents: read');
    expect(permissions).toContain('checks: read');
    expect(permissions).toContain('actions: read');
    expect(permissions).toContain('deployments: read');
    expect(permissions).not.toMatch(/: write/);
  });

  it('binds short-lived GitHub token only to local workerd, outside asset root', () => {
    expect(workflow).toContain('PROOFMODE_CI_GITHUB_TOKEN: ${{ github.token }}');
    expect(workflow).toContain('token_file="$RUNNER_TEMP/proofmode-github-read.env"');
    expect(workflow).toContain('--env-file "$token_file"');
    expect(workflow).toContain('rm -f "$RUNNER_TEMP/proofmode-github-read.env"');
    expect(workflow).not.toContain('--var "PROOFMODE_GITHUB_TOKEN:');
  });

  it('continues to require a real successful audit rather than accepting tool errors', () => {
    const test = readFileSync(
      new URL('../e2e/proofmode-mcp.pw.mjs', import.meta.url),
      'utf8',
    );
    expect(test).toContain('expect(payload.result.isError).toBe(false)');
    expect(test).toContain('expect(payload.result.structuredContent.headSha).toBe(expectedHead)');
  });
});
