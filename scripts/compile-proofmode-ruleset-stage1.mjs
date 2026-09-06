import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateUltrathinkAttackTenRulesetStage1 } from './ultrathink-attack-ten-ruleset-stage1.mjs';

const RULESET_ID = 20818149;
const RULESET_NAME = 'Chief AI main exact-head gate';
const RESERVED_CANDIDATE_CONTEXT = 'Verify candidate ProofMode runtime with Playwright';
const REQUIRED_DEPLOYMENTS = Object.freeze([
  'Cloudflare Production',
  'proofmode-access-admin',
]);
const REQUIRED_BASELINE_CONTEXTS = Object.freeze([
  'Typecheck',
  'Lint',
  'Unit Tests',
  'SonarQube – Founder Intelligence',
  'Verify test-ledger contract',
]);
const FOUNDER_REVIEW_POLICY = Object.freeze({
  requiredApprovingReviewCount: 0,
  dismissStaleReviewsOnPush: false,
  requireLastPushApproval: false,
  requiredReviewThreadResolution: true,
});

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const clone = (value) => JSON.parse(JSON.stringify(value));

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stable(value[key])]),
  );
}

function fingerprint(value) {
  return crypto.createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

function rulesOfType(ruleset, type) {
  return (Array.isArray(ruleset?.rules) ? ruleset.rules : []).filter((rule) => rule?.type === type);
}

function requiredStatusContexts(ruleset) {
  return rulesOfType(ruleset, 'required_status_checks').flatMap((rule) => (
    Array.isArray(rule?.parameters?.required_status_checks)
      ? rule.parameters.required_status_checks.map((check) => clean(check?.context)).filter(Boolean)
      : []
  ));
}

function requiredDeployments(ruleset) {
  return rulesOfType(ruleset, 'required_deployments').flatMap((rule) => (
    Array.isArray(rule?.parameters?.required_deployment_environments)
      ? rule.parameters.required_deployment_environments.map(clean).filter(Boolean)
      : []
  ));
}

function currentReviewPolicy(ruleset) {
  const rules = rulesOfType(ruleset, 'pull_request');
  if (rules.length !== 1) return null;
  const parameters = rules[0]?.parameters || {};
  return {
    requiredApprovingReviewCount: Number(parameters.required_approving_review_count),
    dismissStaleReviewsOnPush: parameters.dismiss_stale_reviews_on_push === true,
    requireLastPushApproval: parameters.require_last_push_approval === true,
    requiredReviewThreadResolution: parameters.required_review_thread_resolution === true,
  };
}

function mutableState(ruleset) {
  return {
    name: ruleset.name,
    target: ruleset.target,
    enforcement: ruleset.enforcement,
    bypass_actors: ruleset.bypass_actors,
    conditions: ruleset.conditions,
    rules: ruleset.rules,
  };
}

export function compileProofModeRulesetStage1({
  ruleset,
  repository = 'jussray/chief-ai-machine',
} = {}) {
  const violations = [];
  const repo = clean(repository);
  const observed = ruleset && typeof ruleset === 'object' && !Array.isArray(ruleset) ? ruleset : {};

  if (observed.id !== RULESET_ID || clean(observed.name) !== RULESET_NAME) {
    violations.push({
      classification: 'wrong-ruleset-carrier',
      expected: { id: RULESET_ID, name: RULESET_NAME },
      observed: { id: observed.id ?? null, name: clean(observed.name) || null },
    });
  }
  if (observed.target !== 'branch' || observed.enforcement !== 'active') {
    violations.push({
      classification: 'ruleset-not-active-branch-carrier',
      target: observed.target ?? null,
      enforcement: observed.enforcement ?? null,
    });
  }
  const includes = Array.isArray(observed?.conditions?.ref_name?.include)
    ? observed.conditions.ref_name.include
    : [];
  const excludes = Array.isArray(observed?.conditions?.ref_name?.exclude)
    ? observed.conditions.ref_name.exclude
    : [];
  if (!includes.includes('~DEFAULT_BRANCH') || excludes.includes('~DEFAULT_BRANCH')) {
    violations.push({
      classification: 'ruleset-default-branch-target-mismatch',
      include: includes,
      exclude: excludes,
    });
  }
  if (!Array.isArray(observed.bypass_actors)) {
    violations.push({
      classification: 'ruleset-bypass-state-unobservable',
      reason: 'trusted administration readback must expose bypass_actors before accepting the live carrier',
    });
  } else if (observed.bypass_actors.length !== 0) {
    violations.push({
      classification: 'ruleset-bypass-actors-present',
      bypassActorCount: observed.bypass_actors.length,
    });
  }

  const pullRequestRules = rulesOfType(observed, 'pull_request');
  if (pullRequestRules.length !== 1) {
    violations.push({
      classification: 'pull-request-rule-ambiguous',
      count: pullRequestRules.length,
    });
  }
  const deploymentRules = rulesOfType(observed, 'required_deployments');
  if (deploymentRules.length !== 1) {
    violations.push({
      classification: 'required-deployments-rule-ambiguous',
      count: deploymentRules.length,
    });
  }

  const review = currentReviewPolicy(observed);
  if (
    review
    && (
      review.requiredApprovingReviewCount !== FOUNDER_REVIEW_POLICY.requiredApprovingReviewCount
      || review.dismissStaleReviewsOnPush !== FOUNDER_REVIEW_POLICY.dismissStaleReviewsOnPush
      || review.requireLastPushApproval !== FOUNDER_REVIEW_POLICY.requireLastPushApproval
      || review.requiredReviewThreadResolution !== FOUNDER_REVIEW_POLICY.requiredReviewThreadResolution
    )
  ) {
    violations.push({
      classification: 'founder-review-model-drift',
      expected: FOUNDER_REVIEW_POLICY,
      observed: review,
      reason: 'The founder is the reviewer for the current operating model; GitHub self-approval or last-pusher approval is not the authority gate.',
    });
  }

  const contexts = requiredStatusContexts(observed);
  for (const context of REQUIRED_BASELINE_CONTEXTS) {
    if (!contexts.includes(context)) {
      violations.push({
        classification: 'baseline-required-status-missing',
        context,
      });
    }
  }
  if (contexts.includes(RESERVED_CANDIDATE_CONTEXT)) {
    violations.push({
      classification: 'reserved-candidate-context-already-required',
      context: RESERVED_CANDIDATE_CONTEXT,
      reason: 'candidate authority remains unbound until the external producer is independently observed',
    });
  }

  const deployments = requiredDeployments(observed);
  for (const environment of REQUIRED_DEPLOYMENTS) {
    if (!deployments.includes(environment)) {
      violations.push({
        classification: 'required-deployment-missing',
        environment,
      });
    }
  }
  const unexpectedDeployments = deployments.filter((environment) => !REQUIRED_DEPLOYMENTS.includes(environment));
  if (unexpectedDeployments.length > 0) {
    violations.push({
      classification: 'required-deployment-topology-drift',
      expected: REQUIRED_DEPLOYMENTS,
      observed: deployments,
      unexpected: unexpectedDeployments,
    });
  }

  const before = mutableState(observed);
  const desired = clone(before);
  const attackTen = evaluateUltrathinkAttackTenRulesetStage1({
    observedRuleset: observed,
    desiredRuleset: desired,
  });

  if (violations.length > 0 || attackTen.status !== 'passed') {
    const attackViolation = attackTen.status === 'passed'
      ? []
      : [{
        classification: 'ultrathink-attack-ten-failed',
        failedAttacks: attackTen.attacks
          .filter((item) => item.status === 'failed')
          .map((item) => item.id),
      }];
    return {
      schemaVersion: 2,
      stage: 'proofmode-ruleset-stage1',
      rulesetId: RULESET_ID,
      rulesetName: RULESET_NAME,
      repository: repo || null,
      status: 'blocked',
      observedFingerprint: fingerprint(before),
      desiredFingerprint: fingerprint(desired),
      violations: [...violations, ...attackViolation],
      attackTen,
      mutation: null,
    };
  }

  return {
    schemaVersion: 2,
    stage: 'proofmode-ruleset-stage1',
    rulesetId: RULESET_ID,
    rulesetName: RULESET_NAME,
    repository: repo,
    status: 'already-compliant',
    observedFingerprint: fingerprint(before),
    desiredFingerprint: fingerprint(desired),
    attackTen,
    reviewAuthority: {
      reviewer: 'founder',
      githubSelfApprovalRequired: false,
      githubLastPusherApprovalRequired: false,
      finalReviewRequiredBeforeMergeDecision: true,
    },
    invariants: {
      zeroBypassActorsPreserved: true,
      conditionsPreserved: true,
      statusChecksPreserved: true,
      requiredDeploymentsPreserved: true,
      reservedCandidateContextRemainsUnbound: true,
      founderReviewAuthorityPreserved: true,
      liveRulesetAcceptedAsAuthority: true,
      mutationRequired: false,
    },
    mutation: null,
  };
}

export function writeProofModeRulesetStage1Receipt({
  ruleset,
  repository = process.env.GITHUB_REPOSITORY || 'jussray/chief-ai-machine',
  outputPath = 'artifacts/proofmode/ruleset-stage1-migration.json',
} = {}) {
  const receipt = compileProofModeRulesetStage1({ ruleset, repository });
  const absolute = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return receipt;
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error('usage: node scripts/compile-proofmode-ruleset-stage1.mjs <observed-ruleset.json> [output.json]');
    process.exit(2);
  }
  const ruleset = JSON.parse(fs.readFileSync(path.resolve(inputPath), 'utf8'));
  const receipt = writeProofModeRulesetStage1Receipt({
    ruleset,
    outputPath: process.argv[3] || 'artifacts/proofmode/ruleset-stage1-migration.json',
  });
  console.log(JSON.stringify(receipt, null, 2));
  if (receipt.status === 'blocked') process.exit(1);
}
