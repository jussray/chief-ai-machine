import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new globalThis.URL('../.github/workflows/proofmode-access-service-auth.yml', import.meta.url),
  'utf8',
);

describe('ProofMode Access admin trusted-main bootstrap', () => {
  it('is repository-dispatch only and binds provider authority to exact current main', () => {
    expect(workflow).toContain('repository_dispatch:');
    expect(workflow).toContain('types: [proofmode_access_admin]');
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).not.toContain('workflow_call:');
    expect(workflow).toContain('EVENT_REF: ${{ github.ref }}');
    expect(workflow).toContain('WORKFLOW_SHA: ${{ github.sha }}');
    expect(workflow).toContain('EXPECTED_MAIN_SHA: ${{ github.event.client_payload.expected_main_sha }}');
    expect(workflow).toContain('if [ "$EVENT_NAME" != "repository_dispatch" ] || [ "$EVENT_REF" != "refs/heads/main" ]; then');
    expect(workflow).toContain('if [ "$EXPECTED_MAIN_SHA" != "$WORKFLOW_SHA" ]; then');
    expect(workflow).toContain('Main moved before provider access');
    expect(workflow).toContain('Main moved at secret-bearing provider boundary');
  });

  it('allows check but requires repository-owner identity for repair and repair reruns', () => {
    expect(workflow).toContain('case "$REQUESTED_MODE" in');
    expect(workflow).toContain('check) ;;');
    expect(workflow).toContain('repair)');
    expect(workflow).toContain('DISPATCH_ACTOR: ${{ github.actor }}');
    expect(workflow).toContain('TRIGGERING_ACTOR: ${{ github.triggering_actor }}');
    expect(workflow).toContain('if [ "$DISPATCH_ACTOR" != "$REPOSITORY_OWNER" ] || [ "$TRIGGERING_ACTOR" != "$REPOSITORY_OWNER" ]; then');
    expect(workflow).toContain('Access repair is repository-owner only');
    expect(workflow).toContain('Access repair rerun authority failed');
  });

  it('accepts only one immutable Chief preview origin with no alternate port', () => {
    expect(workflow).toContain("/^[0-9a-f]{8}-chief-ai\\.mcgill-raylene\\.workers\\.dev$/");
    expect(workflow).toContain("url.protocol !== \"https:\"");
    expect(workflow).toContain('|| url.port');
    expect(workflow).toContain("url.pathname !== \"/\"");
    expect(workflow).toContain('target_url must be one immutable Chief workers.dev preview origin.');
  });

  it('keeps Cloudflare admin credentials behind the protected environment and uses no client secret', () => {
    const guard = workflow.indexOf('  dispatch-identity:');
    const providerJob = workflow.indexOf('  access-policy:');
    const environment = workflow.indexOf('environment: proofmode-access-admin');
    const adminToken = workflow.indexOf('CLOUDFLARE_ACCESS_ADMIN_API_TOKEN: ${{ secrets.CLOUDFLARE_ACCESS_ADMIN_API_TOKEN }}');
    const clientId = workflow.indexOf('CLOUDFLARE_ACCESS_CLIENT_ID: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}');

    expect(guard).toBeGreaterThanOrEqual(0);
    expect(providerJob).toBeGreaterThan(guard);
    expect(environment).toBeGreaterThan(providerJob);
    expect(adminToken).toBeGreaterThan(environment);
    expect(clientId).toBeGreaterThan(environment);
    expect(workflow).not.toContain('CLOUDFLARE_ACCESS_CLIENT_SECRET');
  });

  it('revalidates current main and rerun authority inside the secret-bearing provider step', () => {
    const providerStep = workflow.indexOf('      - name: Check or repair exact Service Auth policy');
    expect(providerStep).toBeGreaterThan(-1);
    const providerSource = workflow.slice(providerStep);
    expect(providerSource).toContain('GH_TOKEN: ${{ github.token }}');
    expect(providerSource).toContain('TRIGGERING_ACTOR: ${{ github.triggering_actor }}');
    expect(providerSource).toContain('"https://api.github.com/repos/$GITHUB_REPOSITORY/branches/main"');
    expect(providerSource).toContain('if [ -z "$current" ] || [ "$current" != "$GITHUB_SHA" ]; then');
    expect(providerSource).toContain('node scripts/proofmode-access-policy.mjs');
  });

  it('executes only the bounded policy engine after the trusted-source guard', () => {
    const providerJob = workflow.indexOf('  access-policy:');
    const scriptCall = workflow.indexOf('node scripts/proofmode-access-policy.mjs');
    expect(scriptCall).toBeGreaterThan(providerJob);
    expect(workflow).not.toContain('curl -X POST');
  });
});
