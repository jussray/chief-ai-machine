import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = '.github/workflows/chief-capability-plan-playwright.yml';
const workflow = fs.readFileSync(WORKFLOW, 'utf8');

describe('Chief capability-plan trusted runtime proof boundary', () => {
  it('runs the evaluator from trusted main and treats the candidate SHA only as data', () => {
    expect(workflow).toContain('pull_request_target:');
    expect(workflow).not.toMatch(/\n {2}pull_request:\n/);
    expect(workflow).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
    expect(workflow).toContain('test "$TRUSTED_EVALUATOR_SHA" = "$BASE_SHA"');
    expect(workflow).toContain('ref: ${{ env.TRUSTED_EVALUATOR_SHA }}');
    expect(workflow).toContain('git diff --no-renames --name-only');
  });

  it('covers the full live capability and Founder Content V4 dependency surface', () => {
    for (const expected of [
      'worker/(index|chief-capability-plan|chief-founder-content-proposal)',
      'capability-plan',
      'capability-registry',
      'connection-requests',
      'goal-plan',
      'outcome-feedback',
      'founder-control-surface',
      'founder-content-brain',
      'founder-content-package',
      'founder-content-strategy-lease',
      'founder-content-strategy',
      'founder-content-v4-advisory',
      'founder-content-visual-direction',
      'v4-advisory-handoff',
      'founder-content-current-review-regressions',
    ]) {
      expect(workflow).toContain(expected);
    }
    expect(workflow).toContain('e2e/(chief-capability-plan|chief-founder-content-proposal)\\.pw\\.mjs$');
    expect(workflow).toContain('testMatch:/(?:chief-capability-plan|chief-founder-content-proposal)\\.pw\\.mjs$/');
    expect(workflow).not.toContain('config/operational-authority.json');
  });

  it('authenticates Cloudflare build provenance and validates immutable preview identity', () => {
    expect(workflow).toContain("CLOUDFLARE_CHECK_APP_ID: '85455'");
    expect(workflow).toContain('x.app?.id===Number(process.env.CLOUDFLARE_CHECK_APP_ID)');
    expect(workflow).toContain('^[0-9a-f]{8}-chief-ai\\.mcgill-raylene\\.workers\\.dev$');
    expect(workflow).toContain('EXPECTED_HEAD_SHA');
  });

  it('never gives long-lived Cloudflare Access credentials to candidate runtime proof', () => {
    expect(workflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_ID');
    expect(workflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(workflow).not.toContain('CF-Access-Client-Id');
    expect(workflow).not.toContain('CF-Access-Client-Secret');
    expect(workflow).toContain('Long-lived Access credentials are intentionally withheld from candidate runtime.');
  });
});
