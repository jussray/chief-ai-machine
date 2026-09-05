import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/proofmode-mcp-playwright.yml', import.meta.url),
  'utf8',
);

describe('ProofMode MCP manual dispatch identity contract', () => {
  it('requires the founder to bind manual proof to an exact selected-ref SHA', () => {
    expect(workflow).toContain('expected_head_sha:');
    expect(workflow).toContain("EXPECTED_HEAD_SHA: ${{ github.event.pull_request.head.sha || inputs.expected_head_sha || github.sha }}");
    expect(workflow).toContain("grep -Eq '^[0-9a-fA-F]{40}$'");
    expect(workflow).toContain('DISPATCH_ACTOR: ${{ github.actor }}');
    expect(workflow).toContain('REPOSITORY_OWNER: ${{ github.repository_owner }}');
    expect(workflow).toContain('if [ "$DISPATCH_ACTOR" != "$REPOSITORY_OWNER" ]; then');
    expect(workflow).toContain('if [ "$EXPECTED_HEAD_SHA" != "$DISPATCH_SHA" ]; then');
    expect(workflow).toContain('Manual ProofMode identity mismatch:');
  });

  it('canonicalizes an immutable manual target before the runtime proof consumes it', () => {
    expect(workflow).toContain('const raw = process.argv[1].trim();');
    expect(workflow).toContain("const immutable = /^[0-9a-f]{8}-chief-ai\\.mcgill-raylene\\.workers\\.dev$/.test(host);");
    expect(workflow).toContain('process.stdout.write(url.origin);');
    expect(workflow).toContain("printf 'base_url=%s\\n' \"$normalized\" >> \"$GITHUB_OUTPUT\"");
    expect(workflow).toContain('GUARDED_BASE_URL: ${{ needs.dispatch-identity.outputs.base_url }}');
    expect(workflow).toContain("printf 'PROOFMODE_BASE_URL=%s\\n' \"$GUARDED_BASE_URL\" >> \"$GITHUB_ENV\"");
  });

  it('keeps ordinary pull-request source proof exact-head bound and runtime proof fail-closed', () => {
    expect(workflow).toContain('github.event.pull_request.head.sha || inputs.expected_head_sha || github.sha');
    expect(workflow).toContain('ref: ${{ env.EXPECTED_HEAD_SHA }}');
    expect(workflow).toContain('test "$actual" = "$EXPECTED_HEAD_SHA"');
    expect(workflow).toContain('PR-authored workflow code is not permitted to enter proofmode-access-admin');
    expect(workflow).toContain("if: ${{ github.event_name == 'workflow_dispatch' }}");
  });
});
