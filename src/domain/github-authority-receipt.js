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

function validStringList(values, maxItems = 100, maxLength = 300) {
  return Array.isArray(values)
    && values.length <= maxItems
    && values.every((value) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maxLength);
}

function validGithubSourceRefs(values) {
  return validStringList(values, 20, 500)
    && values.length > 0
    && values.every((value) => value.trim().startsWith('github:'));
}

function normalizeRuleset(input = {}) {
  return {
    id: cleanText(String(input.id ?? ''), 80),
    name: cleanText(input.name, 180),
    enforcement: cleanText(input.enforcement, 40),
    target: cleanText(input.target, 80) || 'branch',
    includedRefs: cleanStringList(input.includedRefs, 100, 300),
    excludedRefs: cleanStringList(input.excludedRefs, 100, 300),
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

function validateRuleset(ruleset, index) {
  const prefix = `Ruleset ${index + 1}`;
  const errors = [];
  if (!ruleset || typeof ruleset !== 'object' || Array.isArray(ruleset)) {
    return [`${prefix} must be an object`];
  }
  if (!cleanText(String(ruleset.id ?? ''), 80)) errors.push(`${prefix} requires a stable id`);
  if (!cleanText(ruleset.name, 180)) errors.push(`${prefix} requires a name`);
  if (!cleanText(ruleset.enforcement, 40)) errors.push(`${prefix} requires enforcement state`);
  if (!cleanText(ruleset.target, 80)) errors.push(`${prefix} requires a target`);
  if (!validStringList(ruleset.includedRefs, 100, 300)) errors.push(`${prefix} included refs are invalid`);
  if (!validStringList(ruleset.excludedRefs, 100, 300)) errors.push(`${prefix} excluded refs are invalid`);
  if (!Number.isInteger(ruleset.requiredApprovals) || ruleset.requiredApprovals < 0) {
    errors.push(`${prefix} required approvals are invalid`);
  }
  for (const key of [
    'pullRequestRequired',
    'dismissStaleReviews',
    'requireLastPushApproval',
    'requireConversationResolution',
    'strictRequiredStatusChecks',
  ]) {
    if (typeof ruleset[key] !== 'boolean') errors.push(`${prefix} ${key} must be boolean`);
  }
  if (!validStringList(ruleset.requiredChecks, 100, 300)) errors.push(`${prefix} required checks are invalid`);
  if (!validStringList(ruleset.bypassActors, 50, 180)) errors.push(`${prefix} bypass actors are invalid`);
  return errors;
}

function escapeRegex(text) {
  return text.replace(/[\\^$+.()|{}]/g, '\\$&');
}

function githubRefPatternToRegex(pattern) {
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const next = pattern[index + 1];

    if (character === '*' && next === '*') {
      source += '.*';
      index += 1;
      continue;
    }
    if (character === '*') {
      source += '[^/]*';
      continue;
    }
    if (character === '?') {
      source += '[^/]';
      continue;
    }
    if (character === '[') {
      const end = pattern.indexOf(']', index + 1);
      if (end === -1) return null;
      let body = pattern.slice(index + 1, end);
      if (!body) return null;
      if (body.startsWith('!')) body = `^${body.slice(1)}`;
      source += `[${body.replace(/\\/g, '\\\\')}]`;
      index = end;
      continue;
    }
    if (character === '\\' && next !== undefined) {
      source += escapeRegex(next);
      index += 1;
      continue;
    }
    source += escapeRegex(character);
  }
  source += '$';
  try {
    return new RegExp(source);
  } catch {
    return null;
  }
}

function refConditionMatches(condition, branchRef, defaultBranchMatches) {
  if (condition === '~ALL') return true;
  if (condition === '~DEFAULT_BRANCH') return defaultBranchMatches;
  if (condition.startsWith('~')) return false;
  const matcher = githubRefPatternToRegex(condition);
  return matcher ? matcher.test(branchRef) : false;
}

function rulesetAppliesToBranch(ruleset, branch, defaultBranch) {
  if (ruleset.target !== 'branch') return false;
  const branchRef = `refs/heads/${branch}`;
  const defaultBranchMatches = branch === defaultBranch;
  const included = ruleset.includedRefs.some((condition) => refConditionMatches(condition, branchRef, defaultBranchMatches));
  const excluded = ruleset.excludedRefs.some((condition) => refConditionMatches(condition, branchRef, defaultBranchMatches));
  return included && !excluded;
}

function evidenceOnlyAuthority() {
  return { ...GITHUB_AUTHORITY_RECEIPT_AUTHORITY };
}

export function evaluateEffectiveGithubAuthority(rulesets = [], branch = '', defaultBranch = '') {
  const normalizedBranch = cleanText(branch, 180);
  const normalizedDefaultBranch = cleanText(defaultBranch, 180);
  const active = rulesets
    .map(normalizeRuleset)
    .filter((ruleset) => ruleset.enforcement === 'active')
    .filter((ruleset) => normalizedBranch
      && normalizedDefaultBranch
      && rulesetAppliesToBranch(ruleset, normalizedBranch, normalizedDefaultBranch));

  const requiredChecks = [...new Set(active.flatMap((ruleset) => ruleset.requiredChecks))].sort();
  const bypassActors = [...new Set(active.flatMap((ruleset) => ruleset.bypassActors))].sort();

  return {
    branch: normalizedBranch,
    defaultBranch: normalizedDefaultBranch,
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
  const defaultBranch = cleanText(input?.defaultBranch, 180);
  const sourceSha = cleanText(input?.sourceSha, 64);
  const observedAt = cleanIsoTimestamp(input?.observedAt);
  const sourceRefs = cleanStringList(input?.sourceRefs, 20, 500);
  const rawRulesets = Array.isArray(input?.rulesets) ? input.rulesets : [];
  const ruleErrors = rawRulesets.flatMap((ruleset, index) => validateRuleset(ruleset, index));

  if (!repository) throw new Error('GitHub authority receipt repository is required');
  if (!branch) throw new Error('GitHub authority receipt branch is required');
  if (!defaultBranch) throw new Error('GitHub authority receipt default branch is required');
  if (!/^[0-9a-f]{40}$/i.test(sourceSha)) throw new Error('GitHub authority receipt source SHA must be a full commit SHA');
  if (!observedAt) throw new Error('GitHub authority receipt observed timestamp must be valid');
  if (!validGithubSourceRefs(input?.sourceRefs)) throw new Error('GitHub authority receipt requires valid GitHub provider source references');
  if (rawRulesets.length === 0) throw new Error('GitHub authority receipt requires at least one ruleset');
  if (ruleErrors.length > 0) throw new Error(`GitHub authority receipt rulesets are invalid: ${ruleErrors.join('; ')}`);

  const rulesets = rawRulesets.map(normalizeRuleset);
  const effective = evaluateEffectiveGithubAuthority(rulesets, branch, defaultBranch);

  return {
    schemaVersion: GITHUB_AUTHORITY_RECEIPT_SCHEMA_VERSION,
    repository,
    branch,
    defaultBranch,
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
  if (!cleanText(receipt.defaultBranch, 180)) errors.push('Missing default branch');
  if (!/^[0-9a-f]{40}$/i.test(cleanText(receipt.sourceSha, 64))) errors.push('Invalid source SHA');
  if (!cleanIsoTimestamp(receipt.observedAt)) errors.push('Invalid observed timestamp');
  if (!cleanIsoTimestamp(receipt.recordedAt)) errors.push('Invalid recorded timestamp');
  if (receipt.sourceSystem !== 'github-provider-readback') errors.push('Unsupported source system');
  if (!validGithubSourceRefs(receipt.sourceRefs)) errors.push('Invalid provider source references');
  if (!Array.isArray(receipt.rulesets) || receipt.rulesets.length === 0) {
    errors.push('Missing rulesets');
  } else {
    errors.push(...receipt.rulesets.flatMap((ruleset, index) => validateRuleset(ruleset, index)));
  }

  if (errors.length === 0) {
    const recomputedEffective = evaluateEffectiveGithubAuthority(receipt.rulesets, receipt.branch, receipt.defaultBranch);
    if (!receipt.effective || JSON.stringify(receipt.effective) !== JSON.stringify(recomputedEffective)) {
      errors.push('Effective authority fingerprint does not match provider rulesets');
    }
  }

  if (!receipt.authority || JSON.stringify(receipt.authority) !== JSON.stringify(GITHUB_AUTHORITY_RECEIPT_AUTHORITY)) {
    errors.push('Receipt authority must remain evidence-only');
  }

  return { valid: errors.length === 0, errors };
}

export function assessGithubMainAuthority(receipt, context = {}) {
  const validation = validateGithubAuthorityReceipt(receipt);
  if (!validation.valid) return { valid: false, authorized: false, errors: validation.errors };

  const expectedRepository = cleanText(context.expectedRepository, 180);
  const expectedBranch = cleanText(context.expectedBranch, 180);
  const expectedDefaultBranch = cleanText(context.expectedDefaultBranch, 180);
  const expectedSourceSha = cleanText(context.expectedSourceSha, 64);
  const maxAgeMs = Number.isFinite(context.maxAgeMs) && context.maxAgeMs >= 0 ? context.maxAgeMs : null;
  const now = context.now instanceof Date ? context.now : new Date(context.now ?? Date.now());
  const contextErrors = [];

  if (!expectedRepository) contextErrors.push('Expected repository is required');
  if (!expectedBranch) contextErrors.push('Expected branch is required');
  if (!expectedDefaultBranch) contextErrors.push('Expected default branch is required');
  if (!/^[0-9a-f]{40}$/i.test(expectedSourceSha)) contextErrors.push('Expected source SHA must be a full commit SHA');
  if (maxAgeMs === null) contextErrors.push('Freshness bound is required');
  if (Number.isNaN(now.getTime())) contextErrors.push('Assessment timestamp is invalid');
  if (contextErrors.length > 0) return { valid: false, authorized: false, errors: contextErrors };

  const effective = evaluateEffectiveGithubAuthority(receipt.rulesets, receipt.branch, receipt.defaultBranch);
  const missing = [];
  const observedAtMs = Date.parse(receipt.observedAt);
  const ageMs = now.getTime() - observedAtMs;

  if (receipt.repository !== expectedRepository) missing.push('repository-mismatch');
  if (receipt.branch !== expectedBranch) missing.push('branch-mismatch');
  if (receipt.defaultBranch !== expectedDefaultBranch) missing.push('default-branch-mismatch');
  if (receipt.sourceSha !== expectedSourceSha) missing.push('source-sha-mismatch');
  if (ageMs < 0) missing.push('observation-from-future');
  if (ageMs > maxAgeMs) missing.push('stale-observation');
  if (!effective.pullRequestRequired) missing.push('pull-request-required');
  if (effective.requiredApprovals < 1) missing.push('independent-approval');
  if (!effective.dismissStaleReviews) missing.push('dismiss-stale-reviews');
  if (!effective.requireLastPushApproval) missing.push('last-push-approval');
  if (!effective.requireConversationResolution) missing.push('conversation-resolution');
  if (!effective.strictRequiredStatusChecks) missing.push('strict-required-status-checks');
  if (effective.requiredChecks.length === 0) missing.push('named-required-status-check');
  if (!effective.noBypassActors) missing.push('no-bypass-actors');

  return {
    valid: true,
    authorized: missing.length === 0,
    missing,
    effective,
    freshness: {
      ageMs,
      maxAgeMs,
    },
  };
}
