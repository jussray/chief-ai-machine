// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

import { describe, expect, it } from 'vitest';

import {
  GITHUB_AUTHORITY_RECEIPT_AUTHORITY,
  assessGithubMainAuthority,
  createGithubAuthorityReceipt,
  evaluateEffectiveGithubAuthority,
  validateGithubAuthorityReceipt,
} from './github-authority-receipt.js';

const SHA = '2fd4fda0cab12e52ab5096e723884d98bcfe7d10';
const OBSERVED_AT = '2026-08-24T23:43:00.000Z';

function hardenedRulesets() {
  return [
    {
      id: 20818149,
      name: 'Chief AI main exact-head gate',
      enforcement: 'active',
      pullRequestRequired: true,
      requiredApprovals: 0,
      dismissStaleReviews: false,
      requireLastPushApproval: false,
      requireConversationResolution: false,
      strictRequiredStatusChecks: false,
      requiredChecks: ['Quality Gate', 'Control Room Test Ledger'],
      bypassActors: [],
    },
    {
      id: 21261587,
      name: 'governance boundary',
      enforcement: 'active',
      pullRequestRequired: true,
      requiredApprovals: 1,
      dismissStaleReviews: true,
      requireLastPushApproval: true,
      requireConversationResolution: true,
      strictRequiredStatusChecks: true,
      requiredChecks: [],
      bypassActors: [],
    },
  ];
}

function receiptInput(overrides = {}) {
  return {
    repository: 'jussray/chief-ai-machine',
    branch: 'main',
    sourceSha: SHA,
    observedAt: OBSERVED_AT,
    sourceRefs: ['github:ruleset-readback:20818149,21261587'],
    rulesets: hardenedRulesets(),
    ...overrides,
  };
}

describe('GitHub authority receipt', () => {
  it('combines multiple active rulesets into one effective authority fingerprint', () => {
    const effective = evaluateEffectiveGithubAuthority(hardenedRulesets());

    expect(effective.activeRulesetIds).toEqual(['20818149', '21261587']);
    expect(effective.requiredApprovals).toBe(1);
    expect(effective.requiredChecks).toEqual(['Control Room Test Ledger', 'Quality Gate']);
    expect(effective.dismissStaleReviews).toBe(true);
    expect(effective.requireLastPushApproval).toBe(true);
    expect(effective.requireConversationResolution).toBe(true);
    expect(effective.strictRequiredStatusChecks).toBe(true);
    expect(effective.noBypassActors).toBe(true);
  });

  it('creates a provider-readback receipt that has evidence authority only', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput(), new Date('2026-08-24T23:44:00Z'));

    expect(validateGithubAuthorityReceipt(receipt)).toEqual({ valid: true, errors: [] });
    expect(receipt.authority).toEqual(GITHUB_AUTHORITY_RECEIPT_AUTHORITY);
    expect(receipt.authority.permitsMerge).toBe(false);
    expect(receipt.authority.permitsApproval).toBe(false);
    expect(receipt.authority.permitsRulesetMutation).toBe(false);
  });

  it('fails closed when review freshness is missing even if checks are present', () => {
    const rulesets = hardenedRulesets();
    rulesets[1] = { ...rulesets[1], requireLastPushApproval: false };

    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt);

    expect(assessment.authorized).toBe(false);
    expect(assessment.missing).toContain('last-push-approval');
  });

  it('fails closed when any active ruleset exposes a bypass actor', () => {
    const rulesets = hardenedRulesets();
    rulesets[0] = { ...rulesets[0], bypassActors: ['repository-admin'] };

    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt);

    expect(assessment.authorized).toBe(false);
    expect(assessment.missing).toContain('no-bypass-actors');
  });

  it('does not treat inactive rulesets as effective authority', () => {
    const rulesets = hardenedRulesets().map((ruleset) => ({ ...ruleset, enforcement: 'disabled' }));
    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt);

    expect(assessment.authorized).toBe(false);
    expect(assessment.effective.activeRulesetIds).toEqual([]);
    expect(assessment.missing).toContain('pull-request-required');
  });

  it('rejects receipts without exact source identity or provider references', () => {
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceSha: 'main' })))
      .toThrow(/full commit SHA/);
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceRefs: [] })))
      .toThrow(/provider source references/);
  });
});
