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
    },
    {
      id: 21261587,
      name: 'governance boundary',
      enforcement: 'active',
      target: 'branch',
      includedRefs: ['~DEFAULT_BRANCH'],
      excludedRefs: [],
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
    defaultBranch: 'main',
    sourceSha: SHA,
    observedAt: OBSERVED_AT,
    sourceRefs: ['github:ruleset-readback:20818149,21261587'],
    rulesets: hardenedRulesets(),
    ...overrides,
  };
}

function assessmentContext(overrides = {}) {
  return {
    expectedRepository: 'jussray/chief-ai-machine',
    expectedBranch: 'main',
    expectedDefaultBranch: 'main',
    expectedSourceSha: SHA,
    maxAgeMs: 60 * 60 * 1000,
    now: new Date('2026-08-24T23:44:00Z'),
    ...overrides,
  };
}

describe('GitHub authority receipt', () => {
  it('combines only active rulesets that apply to the receipt branch', () => {
    const unrelated = [
      {
        ...hardenedRulesets()[0],
        id: 999,
        target: 'tag',
        includedRefs: ['~ALL'],
        requiredChecks: ['Unrelated Tag Check'],
      },
      {
        ...hardenedRulesets()[1],
        id: 1000,
        includedRefs: ['refs/heads/feature-only'],
        requiredApprovals: 99,
      },
    ];
    const effective = evaluateEffectiveGithubAuthority([...hardenedRulesets(), ...unrelated], 'main', 'main');

    expect(effective.activeRulesetIds).toEqual(['20818149', '21261587']);
    expect(effective.requiredApprovals).toBe(1);
    expect(effective.requiredChecks).toEqual(['Control Room Test Ledger', 'Quality Gate']);
    expect(effective.dismissStaleReviews).toBe(true);
    expect(effective.requireLastPushApproval).toBe(true);
    expect(effective.requireConversationResolution).toBe(true);
    expect(effective.strictRequiredStatusChecks).toBe(true);
    expect(effective.noBypassActors).toBe(true);
  });

  it('resolves ~DEFAULT_BRANCH only against provider default-branch metadata', () => {
    const effective = evaluateEffectiveGithubAuthority(hardenedRulesets(), 'main', 'develop');

    expect(effective.activeRulesetIds).toEqual(['20818149']);
    expect(effective.requiredApprovals).toBe(0);
    expect(effective.requireLastPushApproval).toBe(false);
  });

  it('creates a provider-readback receipt that has evidence authority only', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput(), new Date('2026-08-24T23:44:00Z'));

    expect(validateGithubAuthorityReceipt(receipt)).toEqual({ valid: true, errors: [] });
    expect(receipt.authority).toEqual(GITHUB_AUTHORITY_RECEIPT_AUTHORITY);
    expect(receipt.authority.permitsMerge).toBe(false);
    expect(receipt.authority.permitsApproval).toBe(false);
    expect(receipt.authority.permitsRulesetMutation).toBe(false);
  });

  it('authorizes only when exact identity, freshness, branch authority, checks, and no bypass all hold', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput());
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.valid).toBe(true);
    expect(assessment.authorized).toBe(true);
    expect(assessment.missing).toEqual([]);
  });

  it('fails closed when review freshness is missing even if checks are present', () => {
    const rulesets = hardenedRulesets();
    rulesets[1] = { ...rulesets[1], requireLastPushApproval: false };

    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.authorized).toBe(false);
    expect(assessment.missing).toContain('last-push-approval');
  });

  it('fails closed when any applicable active ruleset exposes a bypass actor', () => {
    const rulesets = hardenedRulesets();
    rulesets[0] = { ...rulesets[0], bypassActors: ['repository-admin'] };

    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.authorized).toBe(false);
    expect(assessment.missing).toContain('no-bypass-actors');
  });

  it('does not treat inactive rulesets as effective authority', () => {
    const rulesets = hardenedRulesets().map((ruleset) => ({ ...ruleset, enforcement: 'disabled' }));
    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.authorized).toBe(false);
    expect(assessment.effective.activeRulesetIds).toEqual([]);
    expect(assessment.missing).toContain('pull-request-required');
  });

  it('requires at least one named required status check', () => {
    const rulesets = hardenedRulesets().map((ruleset) => ({ ...ruleset, requiredChecks: [] }));
    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.authorized).toBe(false);
    expect(assessment.missing).toContain('named-required-status-check');
  });

  it('rejects stale or mismatched authority context before authorizing', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput());

    expect(assessGithubMainAuthority(receipt, assessmentContext({
      expectedRepository: 'jussray/other-repo',
    })).missing).toContain('repository-mismatch');
    expect(assessGithubMainAuthority(receipt, assessmentContext({
      expectedBranch: 'release',
    })).missing).toContain('branch-mismatch');
    expect(assessGithubMainAuthority(receipt, assessmentContext({
      expectedDefaultBranch: 'develop',
    })).missing).toContain('default-branch-mismatch');
    expect(assessGithubMainAuthority(receipt, assessmentContext({
      expectedSourceSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })).missing).toContain('source-sha-mismatch');
    expect(assessGithubMainAuthority(receipt, assessmentContext({
      now: new Date('2026-08-25T02:00:00Z'),
    })).missing).toContain('stale-observation');
  });

  it('requires explicit current-context inputs for an authority assessment', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput());
    const assessment = assessGithubMainAuthority(receipt);

    expect(assessment.valid).toBe(false);
    expect(assessment.authorized).toBe(false);
    expect(assessment.errors).toContain('Expected repository is required');
    expect(assessment.errors).toContain('Expected branch is required');
    expect(assessment.errors).toContain('Expected default branch is required');
    expect(assessment.errors).toContain('Expected source SHA must be a full commit SHA');
    expect(assessment.errors).toContain('Freshness bound is required');
  });

  it('rejects malformed or unattributable provider rulesets', () => {
    expect(() => createGithubAuthorityReceipt(receiptInput({ rulesets: [null] })))
      .toThrow(/Ruleset 1 must be an object/);

    const receipt = createGithubAuthorityReceipt(receiptInput());
    receipt.rulesets = [{ ...receipt.rulesets[0], id: '', includedRefs: [] }];
    const validation = validateGithubAuthorityReceipt(receipt);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Ruleset 1 requires a stable id');
  });

  it('rejects malformed provider source references and missing default branch', () => {
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceRefs: [null] })))
      .toThrow(/valid GitHub provider source references/);
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceRefs: ['email:ruleset-claim'] })))
      .toThrow(/valid GitHub provider source references/);
    expect(() => createGithubAuthorityReceipt(receiptInput({ defaultBranch: '' })))
      .toThrow(/default branch is required/);

    const receipt = createGithubAuthorityReceipt(receiptInput());
    receipt.sourceRefs = [null];
    receipt.defaultBranch = '';
    const validation = validateGithubAuthorityReceipt(receipt);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Invalid provider source references');
    expect(validation.errors).toContain('Missing default branch');
  });

  it('rejects receipts without exact source identity or provider references', () => {
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceSha: 'main' })))
      .toThrow(/full commit SHA/);
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceRefs: [] })))
      .toThrow(/provider source references/);
  });
});
