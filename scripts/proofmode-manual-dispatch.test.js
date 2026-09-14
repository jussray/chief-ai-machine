import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/proofmode-mcp-playwright.yml', import.meta.url),
  'utf8',
);

describe('ProofMode trusted dispatch identity contract', () => {
  it('forbids arbitrary-ref workflow_dispatch for secret-bearing runtime evidence', () => {
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).toContain('repository_dispatch:');
    expect(workflow).toContain('types: [proofmode_candidate_runtime_evidence]');
  });

  it('binds trusted runtime evidence to exact current main plus an exact candidate SHA', () => {
    expect(workflow).toContain('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}');
    expect(workflow).toContain('CANDIDATE_SHA: ${{ github.event.client_payload.expected_head_sha }}');
    expect(workflow).toContain("grep -Eq '^[0-9a-fA-F]{40}$'");
    expect(workflow).toContain('EVENT_REF: ${{ github.ref }}');
    expect(workflow).toContain('WORKFLOW_SHA: ${{ github.sha }}');
    expect(workflow).toContain('if [ "$EVENT_REF" != "refs/heads/main" ]; then');
    expect(workflow).toContain('if [ "$EXPECTED_MAIN_SHA" != "$WORKFLOW_SHA" ]; then');
    expect(workflow).toContain('Current main moved:');
  });

  it('canonicalizes the immutable candidate target before protected runtime evidence consumes it', () => {
    expect(workflow).toContain('CANDIDATE_BASE_URL: ${{ github.event.client_payload.base_url }}');
    expect(workflow).toContain('/^[0-9a-f]{8}-chief-ai\\.mcgill-raylene\\.workers\\.dev$/');
    expect(workflow).toContain('process.stdout.write(url.origin);');
    expect(workflow).toContain("printf 'base_url=%s\\n' \"$normalized\" >> \"$GITHUB_OUTPUT\"");
    expect(workflow).toContain('BASE_URL: ${{ needs.dispatch-identity.outputs.base_url }}');
  });

  it('keeps ordinary pull-request proof source-only and fail-closed', () => {
    expect(workflow).toContain("if: ${{ github.event_name == 'pull_request' }}");
    expect(workflow).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(workflow).toContain('test "$actual" = "$EXPECTED_HEAD_SHA"');
    expect(workflow).toContain('Candidate-authored workflow code is source-only');
  });

  it('does not emit the reserved external candidate authority context', () => {
    expect(workflow).not.toContain('Verify candidate ProofMode runtime with Playwright');
    expect(workflow).toContain('ProofMode trusted runtime evidence');
  });
});
