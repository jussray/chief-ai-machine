// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { describe, expect, it } from 'vitest';

import { createGithubAuthorityReceipt } from './github-authority-receipt.js';
import {
  createGithubAuthorityProvenance,
  githubAuthorityFingerprint,
} from './github-authority-provenance.js';

const SHA = '2fd4fda0cab12e52ab5096e723884d98bcfe7d10';

function receipt(overrides = {}) {
  const rulesets = [{
    id: 20818149,
    name: 'Chief AI main exact-head gate',
    enforcement: 'active',
    target: 'branch',
    includedRefs: ['refs/heads/main'],
    excludedRefs: [],
    pullRequestRequired: true,
    requiredApprovals: 0,
    dismissStaleReviews: false,
    requireLastPushApproval: false,
    requireConversationResolution: false,
    strictRequiredStatusChecks: false,
    requiredChecks: ['Quality Gate', 'Control Room Test Ledger'],
    bypassActors: [],
  }];

  return createGithubAuthorityReceipt({
    repository: 'jussray/chief-ai-machine',
    branch: 'main',
    defaultBranch: 'main',
    sourceSha: SHA,
    observedAt: '2026-09-05T19:00:00.000Z',
    sourceRefs: ['github:repository:jussray/chief-ai-machine:ruleset:20818149'],
    rulesets,
    ...overrides,
  }, new Date('2026-09-05T19:01:00.000Z'));
}

describe('GitHub authority provenance fingerprint and cookie', () => {
  it('derives deterministic provenance with no browser or action authority', () => {
    const input = receipt();
    const first = createGithubAuthorityProvenance(input);
    const second = createGithubAuthorityProvenance(input);

    expect(first).toEqual(second);
    expect(first.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(first.cookie.fingerprint).toBe(first.fingerprint);
    expect(first.cookie.browserCookie).toBe(false);
    expect(first.cookie.secretMaterial).toBe(false);
    expect(first.cookie.actionAuthority).toBe(false);
    expect(first.cookie.mergeAuthority).toBe(false);
    expect(first.cookie.providerMutationAuthority).toBe(false);
    expect(first.cookie.approvalAuthority).toBe(false);
    expect(first.cookie.provenanceOnly).toBe(true);
    expect(first.cookie.boundedToSourceSha).toBe(SHA);
  });

  it('changes fingerprint when exact source truth moves', () => {
    const original = receipt();
    const moved = receipt({ sourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });

    expect(githubAuthorityFingerprint(original)).not.toBe(githubAuthorityFingerprint(moved));
  });

  it('changes fingerprint when provider policy truth moves', () => {
    const original = receipt();
    const movedRulesets = [{
      ...original.rulesets[0],
      requiredApprovals: 1,
    }];
    const moved = receipt({ rulesets: movedRulesets });

    expect(githubAuthorityFingerprint(original)).not.toBe(githubAuthorityFingerprint(moved));
  });

  it('refuses to mint provenance from a tampered authority receipt', () => {
    const input = receipt();
    input.repository = 'jussray/other-repo';

    expect(() => createGithubAuthorityProvenance(input)).toThrow(/GitHub authority receipt is invalid/);
  });
});
