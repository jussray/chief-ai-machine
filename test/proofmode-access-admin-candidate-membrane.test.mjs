import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
  new globalThis.URL('../.github/workflows/proofmode-access-admin-gate.yml', import.meta.url),
  'utf8',
);

describe('ProofMode Access admin candidate membrane', () => {
  it('keeps protected provider authority out of candidate-authored PR execution', () => {
    expect(workflow).toContain('pull_request:');
    expect(workflow).not.toContain('workflow_dispatch:');
    expect(workflow).not.toContain('environment: proofmode-access-admin');
    expect(workflow).not.toContain('secrets.CLOUDFLARE_ACCESS_CLIENT_ID');
    expect(workflow).not.toContain('secrets.CLOUDFLARE_ACCESS_CLIENT_SECRET');
    expect(workflow).not.toContain('actions/checkout@');
    expect(workflow).not.toContain('verify-cloudflare-runtime-identity.mjs');
    expect(workflow).not.toContain('playwright');
    expect(workflow).toContain('Candidate PRs are source-only for proofmode-access-admin.');
    expect(workflow).toContain('Canonical provider-admin ownership remains with');
  });

  it('treats the candidate SHA as non-executable data only', () => {
    expect(workflow).toContain('CANDIDATE_SHA: ${{ github.event.pull_request.head.sha }}');
    expect(workflow).toContain("grep -Eq '^[0-9a-f]{40}$'");
    expect(workflow).toContain('Candidate SHA observed as non-executable data');
  });
});
