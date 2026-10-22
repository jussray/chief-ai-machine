import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/governance-boundary-required-receipts.yml', import.meta.url),
  'utf8',
);

describe('Chief exact-head candidate runtime evidence boundary', () => {
  it('does not invent success when the external build check is missing', () => {
    expect(workflow).toContain('Observe exact-head Cloudflare build check (non-authorizing)');
    expect(workflow).toContain('provider-build: NOT_VERIFIED (missing or incomplete)');
    expect(workflow).toContain('provider-release-authority: FALSE');
    expect(workflow).toContain('provider-api-readback: NOT_VERIFIED (GitHub lookup unavailable)');
    expect(workflow).toContain('if ! fetched="$(curl --fail --silent --show-error');
    expect(workflow).toContain('try { data = JSON.parse(input); } catch {');
    expect(workflow).toContain('item.app?.id === 85455');
    expect(workflow).not.toContain('Require exact-head Cloudflare build materialization');
  });

  it('fails an observed non-successful completed provider build', () => {
    expect(workflow).toContain('if [ "$state" = "completed:success" ]');
    expect(workflow).toContain('elif [[ "$state" == completed:* ]]');
    expect(workflow).toContain('exit 1');
  });

  it('requires local exact-head Worker and Playwright instead of Cloudflare Access credentials', () => {
    expect(workflow).toContain('Start exact checked-out Worker locally for pull-request proof');
    expect(workflow).toContain('Verify exact runtime identity with Playwright');
    expect(workflow).toContain('body?.sha !== process.env.EXPECTED_HEAD_SHA');
    expect(workflow).toContain("github.event_name == 'workflow_dispatch' && secrets.CLOUDFLARE_ACCESS_CLIENT_ID");
    expect(workflow).toContain('production-provider-deploy-proof: NOT_CLAIMED');
    const observer = workflow.split('      - name: Observe exact-head Cloudflare build check (non-authorizing)')[1].split('      - name: Start exact checked-out Worker locally for pull-request proof')[0];
    const verified = workflow.split('      - name: Verify exact runtime identity with Playwright')[1].split('      - name: Preserve local runtime log')[0];
    expect(observer).toContain('exact-head-source-runtime: NOT_VERIFIED');
    expect(observer).not.toContain('exact-head-runtime-identity: VERIFIED');
    expect(verified).toContain('exact-head-runtime-identity: VERIFIED (Playwright completed for exact head)');
    expect(verified.indexOf('exact-head-runtime-identity: VERIFIED')).toBeGreaterThan(verified.indexOf('          NODE'));
  });
});
