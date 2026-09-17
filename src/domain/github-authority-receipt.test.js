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
const REPOSITORY = 'jussray/chief-ai-machine';

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

function sourceRefs(repository = REPOSITORY, ids = ['20818149', '21261587']) {
  return ids.map((id) => `github:repository:${repository}:ruleset:${id}`);
}

function receiptInput(overrides = {}) {
  return {
    repository: REPOSITORY,
    branch: 'main',
    defaultBranch: 'main',
    sourceSha: SHA,
    observedAt: OBSERVED_AT,
    sourceRefs: sourceRefs(),
    rulesets: hardenedRulesets(),
    ...overrides,
  };
}

function assessmentContext(overrides = {}) {
  return {
    expectedRepository: REPOSITORY,
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

  it('honors GitHub-style wildcard branch exclusions before aggregating authority', () => {
    const rulesets = hardenedRulesets();
    rulesets[0] = {
      ...rulesets[0],
      includedRefs: ['~ALL'],
      excludedRefs: ['refs/heads/m*'],
    };

    const effective = evaluateEffectiveGithubAuthority(rulesets, 'main', 'main');
    expect(effective.activeRulesetIds).toEqual(['21261587']);
    expect(effective.requiredChecks).toEqual([]);
  });

  it('treats standalone recursive **/ patterns as matching zero or more directory levels', () => {
    const recursive = {
      ...hardenedRulesets()[0],
      id: 3001,
      includedRefs: ['refs/heads/**/release'],
      excludedRefs: [],
    };

    expect(evaluateEffectiveGithubAuthority([recursive], 'release', 'main').activeRulesetIds)
      .toEqual(['3001']);
    expect(evaluateEffectiveGithubAuthority([recursive], 'team/release', 'main').activeRulesetIds)
      .toEqual(['3001']);
    expect(evaluateEffectiveGithubAuthority([recursive], 'team/deep/release', 'main').activeRulesetIds)
      .toEqual(['3001']);
  });

  it('keeps the slash mandatory when ** is embedded in a ref path component', () => {
    const embedded = {
      ...hardenedRulesets()[0],
      id: 3002,
      includedRefs: ['refs/heads/re**/main'],
      excludedRefs: [],
    };

    expect(evaluateEffectiveGithubAuthority([embedded], 'remain', 'main').activeRulesetIds)
      .toEqual([]);
  });

  it('creates a provider-readback receipt that has evidence authority only', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput(), new Date('2026-08-24T23:44:00Z'));

    expect(validateGithubAuthorityReceipt(receipt)).toEqual({ valid: true, errors: [] });
    expect(receipt.authority).toEqual(GITHUB_AUTHORITY_RECEIPT_AUTHORITY);
    expect(receipt.authority.permitsMerge).toBe(false);
    expect(receipt.authority.permitsApproval).toBe(false);
    expect(receipt.authority.permitsRulesetMutation).toBe(false);
  });

  it('reports policy satisfaction without minting current authorization', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput());
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.valid).toBe(true);
    expect(assessment.policySatisfied).toBe(true);
    expect(assessment.authorized).toBe(false);
    expect(assessment.authorizationStatus).toBe('not-proven-by-policy-receipt');
    expect(assessment.missing).toEqual([]);
  });

  it('fails closed when review freshness is missing even if checks are present', () => {
    const rulesets = hardenedRulesets();
    rulesets[1] = { ...rulesets[1], requireLastPushApproval: false };

    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.authorized).toBe(false);
    expect(assessment.policySatisfied).toBe(false);
    expect(assessment.missing).toContain('last-push-approval');
  });

  it('fails closed when any applicable active ruleset exposes a bypass actor', () => {
    const rulesets = hardenedRulesets();
    rulesets[0] = { ...rulesets[0], bypassActors: ['repository-admin'] };

    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.authorized).toBe(false);
    expect(assessment.policySatisfied).toBe(false);
    expect(assessment.missing).toContain('no-bypass-actors');
  });

  it('does not treat inactive rulesets as effective authority', () => {
    const rulesets = hardenedRulesets().map((ruleset) => ({ ...ruleset, enforcement: 'disabled' }));
    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.authorized).toBe(false);
    expect(assessment.policySatisfied).toBe(false);
    expect(assessment.effective.activeRulesetIds).toEqual([]);
    expect(assessment.missing).toContain('pull-request-required');
  });

  it('requires at least one named required status check', () => {
    const rulesets = hardenedRulesets().map((ruleset) => ({ ...ruleset, requiredChecks: [] }));
    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.authorized).toBe(false);
    expect(assessment.policySatisfied).toBe(false);
    expect(assessment.missing).toContain('named-required-status-check');
  });

  it('requires Chief authoritative status checks by name', () => {
    const rulesets = hardenedRulesets();
    rulesets[0] = { ...rulesets[0], requiredChecks: ['noop'] };

    const receipt = createGithubAuthorityReceipt(receiptInput({ rulesets }));
    const assessment = assessGithubMainAuthority(receipt, assessmentContext());

    expect(assessment.policySatisfied).toBe(false);
    expect(assessment.missing).toContain('required-status-check:Quality Gate');
    expect(assessment.missing).toContain('required-status-check:Control Room Test Ledger');
  });

  it('rejects stale or mismatched authority context before policy satisfaction', () => {
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
    expect(assessment.policySatisfied).toBe(false);
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

  it('pins provider receipts to the Chief AI repository', () => {
    expect(() => createGithubAuthorityReceipt(receiptInput({
      repository: 'jussray/other-repo',
      sourceRefs: sourceRefs('jussray/other-repo'),
    }))).toThrow(/repository must be jussray\/chief-ai-machine/);

    const receipt = createGithubAuthorityReceipt(receiptInput());
    receipt.repository = 'jussray/other-repo';
    receipt.sourceRefs = sourceRefs('jussray/other-repo');

    const validation = validateGithubAuthorityReceipt(receipt);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Repository must be jussray/chief-ai-machine');
  });

  it('rejects malformed provider source references and missing default branch', () => {
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceRefs: [null] })))
      .toThrow(/source references bound to the exact repository/);
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceRefs: ['email:ruleset-claim'] })))
      .toThrow(/source references bound to the exact repository/);
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceRefs: ['github:ruleset-readback:20818149,21261587'] })))
      .toThrow(/source references bound to the exact repository/);
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

  it('binds provider source references to the exact repository and complete ruleset id set', () => {
    expect(() => createGithubAuthorityReceipt(receiptInput({
      sourceRefs: sourceRefs('jussray/other-repo'),
    }))).toThrow(/source references bound to the exact repository/);

    expect(() => createGithubAuthorityReceipt(receiptInput({
      sourceRefs: sourceRefs(REPOSITORY, ['20818149']),
    }))).toThrow(/source references bound to the exact repository/);

    expect(() => createGithubAuthorityReceipt(receiptInput({
      sourceRefs: sourceRefs(REPOSITORY, ['20818149', '21261587', '99999999']),
    }))).toThrow(/source references bound to the exact repository/);

    const receipt = createGithubAuthorityReceipt(receiptInput());
    receipt.repository = 'jussray/other-repo';
    expect(validateGithubAuthorityReceipt(receipt).errors).toContain('Invalid provider source references');

    const changedRuleset = createGithubAuthorityReceipt(receiptInput());
    changedRuleset.rulesets[1] = { ...changedRuleset.rulesets[1], id: '99999999' };
    expect(validateGithubAuthorityReceipt(changedRuleset).errors).toContain('Invalid provider source references');
  });

  it('rejects duplicate ruleset ids and duplicate provider source references', () => {
    const duplicateRulesets = [
      ...hardenedRulesets(),
      { ...hardenedRulesets()[0], requiredChecks: [] },
    ];

    expect(() => createGithubAuthorityReceipt(receiptInput({
      rulesets: duplicateRulesets,
      sourceRefs: [...sourceRefs(), sourceRefs()[0]],
    }))).toThrow(/ruleset ids must be unique/);

    const receipt = createGithubAuthorityReceipt(receiptInput());
    receipt.sourceRefs = [...receipt.sourceRefs, receipt.sourceRefs[0]];
    expect(validateGithubAuthorityReceipt(receipt).errors).toContain('Invalid provider source references');

    const duplicateLoaded = createGithubAuthorityReceipt(receiptInput());
    duplicateLoaded.rulesets.push({ ...duplicateLoaded.rulesets[0] });
    duplicateLoaded.sourceRefs.push(duplicateLoaded.sourceRefs[0]);
    const validation = validateGithubAuthorityReceipt(duplicateLoaded);
    expect(validation.errors).toContain('Ruleset ids must be unique');
    expect(validation.errors).toContain('Invalid provider source references');
  });

  it('rejects empty provider provenance after serialization or external loading', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput());
    receipt.sourceRefs = [];

    const validation = validateGithubAuthorityReceipt(receipt);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Invalid provider source references');
  });

  it('rejects impossible observation and recording chronology', () => {
    expect(() => createGithubAuthorityReceipt(
      receiptInput({ observedAt: '2026-08-24T23:45:00.000Z' }),
      new Date('2026-08-24T23:44:00.000Z'),
    )).toThrow(/observation cannot be later than recorded time/);

    const receipt = createGithubAuthorityReceipt(
      receiptInput(),
      new Date('2026-08-24T23:44:00.000Z'),
    );
    receipt.observedAt = '2026-08-24T23:45:00.000Z';

    const validation = validateGithubAuthorityReceipt(receipt);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Observation timestamp cannot be later than recorded timestamp');
  });

  it('rejects a stored effective fingerprint that does not match provider rulesets', () => {
    const receipt = createGithubAuthorityReceipt(receiptInput());
    receipt.effective = {
      ...receipt.effective,
      requiredApprovals: 99,
    };

    const validation = validateGithubAuthorityReceipt(receipt);
    expect(validation.valid).toBe(false);
    expect(validation.errors).toContain('Effective authority fingerprint does not match provider rulesets');
    expect(assessGithubMainAuthority(receipt, assessmentContext()).authorized).toBe(false);
  });

  it('rejects receipts without exact source identity or provider references', () => {
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceSha: 'main' })))
      .toThrow(/full commit SHA/);
    expect(() => createGithubAuthorityReceipt(receiptInput({ sourceRefs: [] })))
      .toThrow(/source references bound to the exact repository/);
  });
});
