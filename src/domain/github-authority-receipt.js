// Copyright © 2026 Juss Ray. All rights reserved. Proprietary and confidential.

export const GITHUB_AUTHORITY_RECEIPT_SCHEMA_VERSION = 1;

export const GITHUB_AUTHORITY_RECEIPT_AUTHORITY = Object.freeze({
  scope: 'evidence-only',
  permitsRepositoryWrite: false,
  permitsMerge: false,
  permitsApproval: false,
  permitsRulesetMutation: false,
  permitsDeployment: false,
  permitsSecretMutation: false,
});

function cleanText(value, maxLength = 500) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cleanIsoTimestamp(value) {
  const text = cleanText(value, 40);
  if (!text || Number.isNaN(Date.parse(text))) return '';
  return new Date(text).toISOString();
}

function cleanStringList(values, maxItems = 100, maxLength = 300) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => cleanText(value, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function normalizeRuleset(input = {}) {
  return {
    id: cleanText(String(input.id ?? ''), 80),
    name: cleanText(input.name, 180),
    enforcement: cleanText(input.enforcement, 40),
    target: cleanText(input.target, 80) || 'branch',
    pullRequestRequired: input.pullRequestRequired === true,
    requiredApprovals: Number.isInteger(input.requiredApprovals) && input.requiredApprovals >= 0
      ? input.requiredApprovals
      : 0,
    dismissStaleReviews: input.dismissStaleReviews === true,
    requireLastPushApproval: input.requireLastPushApproval === true,
    requireConversationResolution: input.requireConversationResolution === true,
    strictRequiredStatusChecks: input.strictRequiredStatusChecks === true,
    requiredChecks: cleanStringList(input.requiredChecks),
    bypassActors: cleanStringList(input.bypassActors, 50, 180),
  };
}

function evidenceOnlyAuthority() {
  return { ...GITHUB_AUTHORITY_RECEIPT_AUTHORITY };
}

export function evaluateEffectiveGithubAuthority(rulesets = []) {
  const active = rulesets
    .map(normalizeRuleset)
    .filter((ruleset) => ruleset.enforcement === 'active');

  const requiredChecks = [...new Set(active.flatMap((ruleset) => ruleset.requiredChecks))].sort();
  const bypassActors = [...new Set(active.flatMap((ruleset) => ruleset.bypassActors))].sort();

  return {
    activeRulesetIds: active.map((ruleset) => ruleset.id).filter(Boolean),
    pullRequestRequired: active.some((ruleset) => ruleset.pullRequestRequired),
    requiredApprovals: active.reduce((maximum, ruleset) => Math.max(maximum, ruleset.requiredApprovals), 0),
    dismissStaleReviews: active.some((ruleset) => ruleset.dismissStaleReviews),
    requireLastPushApproval: active.some((ruleset) => ruleset.requireLastPushApproval),
    requireConversationResolution: active.some((ruleset) => ruleset.requireConversationResolution),
    strictRequiredStatusChecks: active.some((ruleset) => ruleset.strictRequiredStatusChecks),
    requiredChecks,
    bypassActors,
    noBypassActors: active.length > 0 && bypassActors.length === 0,
  };
}

export function createGithubAuthorityReceipt(input, now = new Date()) {
  const repository = cleanText(input?.repository, 180);
  const branch = cleanText(input?.branch, 180);
  const sourceSha = cleanText(input?.sourceSha, 64);
  const observedAt = cleanIsoTimestamp(input?.observedAt);
  const sourceRefs = cleanStringList(input?.sourceRefs, 20, 500);
  const rulesets = Array.isArray(input?.rulesets) ? input.rulesets.map(normalizeRuleset) : [];

  if (!repository) throw new Error('GitHub authority receipt repository is required');
  if (!branch) throw new Error('GitHub authority receipt branch is required');
  if (!/^[0-9a-f]{40}$/i.test(sourceSha)) throw new Error('GitHub authority receipt source SHA must be a full commit SHA');
  if (!observedAt) throw new Error('GitHub authority receipt observed timestamp must be valid');
  if (sourceRefs.length === 0) throw new Error('GitHub authority receipt requires provider source references');
  if (rulesets.length === 0) throw new Error('GitHub authority receipt requires at least one ruleset');

  const effective = evaluateEffectiveGithubAuthority(rulesets);

  return {
    schemaVersion: GITHUB_AUTHORITY_RECEIPT_SCHEMA_VERSION,
    repository,
    branch,
    sourceSha,
    observedAt,
    recordedAt: now.toISOString(),
    sourceSystem: 'github-provider-readback',
    sourceRefs,
    rulesets,
    effective,
    authority: evidenceOnlyAuthority(),
  };
}

export function validateGithubAuthorityReceipt(receipt) {
  const errors = [];

  if (!receipt || typeof receipt !== 'object' || Array.isArray(receipt)) {
    return { valid: false, errors: ['GitHub authority receipt must be an object'] };
  }

  if (receipt.schemaVersion !== GITHUB_AUTHORITY_RECEIPT_SCHEMA_VERSION) errors.push('Unsupported schema version');
  if (!cleanText(receipt.repository, 180)) errors.push('Missing repository');
  if (!cleanText(receipt.branch, 180)) errors.push('Missing branch');
  if (!/^[0-9a-f]{40}$/i.test(cleanText(receipt.sourceSha, 64))) errors.push('Invalid source SHA');
  if (!cleanIsoTimestamp(receipt.observedAt)) errors.push('Invalid observed timestamp');
  if (!cleanIsoTimestamp(receipt.recordedAt)) errors.push('Invalid recorded timestamp');
  if (receipt.sourceSystem !== 'github-provider-readback') errors.push('Unsupported source system');
  if (!Array.isArray(receipt.sourceRefs) || receipt.sourceRefs.length === 0) errors.push('Missing provider source references');
  if (!Array.isArray(receipt.rulesets) || receipt.rulesets.length === 0) errors.push('Missing rulesets');
  if (!receipt.authority || JSON.stringify(receipt.authority) !== JSON.stringify(GITHUB_AUTHORITY_RECEIPT_AUTHORITY)) {
    errors.push('Receipt authority must remain evidence-only');
  }

  return { valid: errors.length === 0, errors };
}

export function assessGithubMainAuthority(receipt) {
  const validation = validateGithubAuthorityReceipt(receipt);
  if (!validation.valid) return { valid: false, authorized: false, errors: validation.errors };

  const effective = evaluateEffectiveGithubAuthority(receipt.rulesets);
  const missing = [];

  if (!effective.pullRequestRequired) missing.push('pull-request-required');
  if (effective.requiredApprovals < 1) missing.push('independent-approval');
  if (!effective.dismissStaleReviews) missing.push('dismiss-stale-reviews');
  if (!effective.requireLastPushApproval) missing.push('last-push-approval');
  if (!effective.requireConversationResolution) missing.push('conversation-resolution');
  if (!effective.strictRequiredStatusChecks) missing.push('strict-required-status-checks');
  if (!effective.noBypassActors) missing.push('no-bypass-actors');

  return {
    valid: true,
    authorized: missing.length === 0,
    missing,
    effective,
  };
}
