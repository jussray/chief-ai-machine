import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new globalThis.URL('../.github/workflows/proofmode-access-readback-command.yml', import.meta.url),
  'utf8',
);

describe('ProofMode Access readback command bridge', () => {
  it('is a default-branch issue-comment bridge restricted to the repository owner and merged carrier #147', () => {
    expect(workflow).toContain('issue_comment:');
    expect(workflow).toContain('types: [created]');
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).toContain('github.event.issue.number == 147');
    expect(workflow).toContain('github.event.comment.user.login == github.repository_owner');
    expect(workflow).toContain("github.event.comment.author_association == 'OWNER'");
    expect(workflow).toContain("startsWith(github.event.comment.body, '/proofmode-access-check ')");
  });

  it('binds the command to exact current main and one immutable Chief preview origin', () => {
    expect(workflow).toContain('EVENT_REF: ${{ github.ref }}');
    expect(workflow).toContain('WORKFLOW_SHA: ${{ github.sha }}');
    expect(workflow).toContain('if [ "$EVENT_REF" != "refs/heads/main" ]; then');
    expect(workflow).toContain('if [ -z "$current" ] || [ "$current" != "$WORKFLOW_SHA" ]; then');
    expect(workflow).toContain('/^\\/proofmode-access-check\\s+(https:\\/\\/[0-9a-f]{8}-chief-ai\\.mcgill-raylene\\.workers\\.dev\\/?)\\s*$/');
    expect(workflow).toContain('Owner command must be: /proofmode-access-check <immutable Chief preview origin>.');
  });

  it('can emit only a check-mode proofmode_access_admin dispatch and has no provider secrets', () => {
    expect(workflow).toContain("event_type: 'proofmode_access_admin'");
    expect(workflow).toContain("mode: 'check'");
    expect(workflow).not.toContain("mode: 'repair'");
    expect(workflow).not.toContain('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN');
    expect(workflow).not.toContain('CLOUDFLARE_WORKERS_READ_API_TOKEN');
    expect(workflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_ID');
    expect(workflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(workflow).not.toContain('environment: proofmode-access-admin');
  });
});
