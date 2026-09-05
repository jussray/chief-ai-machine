import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/proofmode-mcp-playwright.yml', import.meta.url),
  'utf8',
);

describe('ProofMode MCP manual dispatch identity contract', () => {
  it('requires the caller to bind manual proof to an exact selected-ref SHA', () => {
    expect(workflow).toContain('expected_head_sha:');
    expect(workflow).toContain("EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || inputs.expected_head_sha || github.sha }}");
    expect(workflow).toContain("grep -Eq '^[0-9a-fA-F]{40}$'");
    expect(workflow).toContain('if [ "$EXPECTED_HEAD_SHA" != "$DISPATCH_SHA" ]; then');
    expect(workflow).toContain('Manual ProofMode identity mismatch:');
  });

  it('canonicalizes the manual target before the runtime proof consumes it', () => {
    expect(workflow).toContain('const raw = process.argv[1].trim();');
    expect(workflow).toContain('process.stdout.write(url.origin);');
    expect(workflow).toContain("printf 'base_url=%s\\n' \"$normalized\" >> \"$GITHUB_OUTPUT\"");
    expect(workflow).toContain("MANUAL_BASE_URL: ${{ github.event_name == 'workflow_dispatch' && needs.dispatch-identity.outputs.base_url || '' }}");
  });

  it('keeps ordinary pull-request proof exact-head bound', () => {
    expect(workflow).toContain('github.event.pull_request.head.sha || inputs.expected_head_sha || github.sha');
    expect(workflow).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(workflow).toContain('test "$actual" = "$EXPECTED_HEAD_SHA"');
  });
});
