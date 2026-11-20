import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new URL('../.github/workflows/governance-boundary-required-receipts.yml', import.meta.url),
  'utf8',
);

describe('Chief exact-head candidate runtime evidence boundary', () => {
  it('fails closed when the official exact-head provider build is missing', () => {
    expect(workflow).toContain('Require exact-head Cloudflare build materialization');
    expect(workflow).toContain("CLOUDFLARE_CHECK_APP_ID: '85455'");
    expect(workflow).toContain('item.head_sha === process.env.EXPECTED_HEAD_SHA');
    expect(workflow).toContain('item.app?.id === Number(process.env.CLOUDFLARE_CHECK_APP_ID)');
    expect(workflow).toContain('Cloudflare build check did not materialize for');
    expect(workflow).toContain('exit 1');
  });

  it('rejects a completed unsuccessful build instead of labeling it proof', () => {
    expect(workflow).toContain('if [ "$state" = "completed:success" ]');
    expect(workflow).toContain('if [[ "$state" == completed:* ]] && [ "$state" != "completed:success" ]');
    expect(workflow).toContain('Cloudflare build check finished without success');
    expect(workflow).toContain('provider-runtime-equivalence: not-claimed-by-pull-request');
  });

  it('proves the checked-out SHA locally without pretending it is production', () => {
    expect(workflow).toContain('Start exact checked-out Worker locally for pull-request proof');
    expect(workflow).toContain('Verify exact runtime identity with Playwright');
    expect(workflow).toContain('body?.sha !== process.env.EXPECTED_HEAD_SHA');
    expect(workflow).toContain('GITHUB_SHA="$EXPECTED_HEAD_SHA"');
    expect(workflow).toContain('Local workerd runtime is serving exact head');
    expect(workflow).toContain('Cloudflare Access: remains a separate privileged provider boundary');
    expect(workflow).toContain('Playwright verified exact runtime head');
  });
});
