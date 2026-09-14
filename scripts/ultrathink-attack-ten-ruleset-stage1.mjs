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

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value).sort().map((key) => [key, stable(value[key])]),
  );
}

function same(left, right) {
  return JSON.stringify(stable(left)) === JSON.stringify(stable(right));
}

function mutableState(ruleset) {
  return {
    name: ruleset?.name,
    target: ruleset?.target,
    enforcement: ruleset?.enforcement,
    bypass_actors: ruleset?.bypass_actors,
    conditions: ruleset?.conditions,
    rules: ruleset?.rules,
  };
}

function rulesOfType(ruleset, type) {
  return (Array.isArray(ruleset?.rules) ? ruleset.rules : []).filter((rule) => rule?.type === type);
}

function statusChecks(ruleset) {
  return rulesOfType(ruleset, 'required_status_checks').flatMap((rule) => (
    Array.isArray(rule?.parameters?.required_status_checks)
      ? rule.parameters.required_status_checks
      : []
  ));
}

function statusContexts(ruleset) {
  return statusChecks(ruleset).map((check) => clean(check?.context)).filter(Boolean);
}

function deployments(ruleset) {
  return rulesOfType(ruleset, 'required_deployments').flatMap((rule) => (
    Array.isArray(rule?.parameters?.required_deployment_environments)
      ? rule.parameters.required_deployment_environments.map(clean).filter(Boolean)
      : []
  ));
}

function reviewPolicy(ruleset) {
  const rules = rulesOfType(ruleset, 'pull_request');
  if (rules.length !== 1) return null;
  return rules[0]?.parameters || {};
}

function attack(id, claim, passed, evidence) {
  return {
    id,
    claim,
    status: passed ? 'passed' : 'failed',
    evidence,
  };
}

export function evaluateUltrathinkAttackTenRulesetStage1({
  observedRuleset,
  desiredRuleset = null,
} = {}) {
  const observed = observedRuleset && typeof observedRuleset === 'object' && !Array.isArray(observedRuleset)
    ? observedRuleset
    : {};
  const desired = desiredRuleset && typeof desiredRuleset === 'object' && !Array.isArray(desiredRuleset)
    ? desiredRuleset
    : null;

  const includes = Array.isArray(observed?.conditions?.ref_name?.include)
    ? observed.conditions.ref_name.include
    : [];
  const excludes = Array.isArray(observed?.conditions?.ref_name?.exclude)
    ? observed.conditions.ref_name.exclude
    : [];
  const observedContexts = statusContexts(observed);
  const observedDeployments = deployments(observed);
  const observedReview = reviewPolicy(observed);
  const desiredContexts = desired ? statusContexts(desired) : [];
  const desiredDeployments = desired ? deployments(desired) : [];
  const desiredReview = desired ? reviewPolicy(desired) : null;

  const attacks = [
    attack(
      'ATK-01-carrier-identity',
      'The approved governance object is the Chief exact-head ruleset carrier.',
      observed.id === RULESET_ID && clean(observed.name) === RULESET_NAME,
      { observedId: observed.id ?? null, observedName: clean(observed.name) || null },
    ),
    attack(
      'ATK-02-active-branch-carrier',
      'The carrier is an active branch ruleset.',
      observed.target === 'branch' && observed.enforcement === 'active',
      { target: observed.target ?? null, enforcement: observed.enforcement ?? null },
    ),
    attack(
      'ATK-03-default-branch-scope',
      'The carrier protects the default branch and does not exclude it.',
      includes.includes('~DEFAULT_BRANCH') && !excludes.includes('~DEFAULT_BRANCH'),
      { include: includes, exclude: excludes },
    ),
    attack(
      'ATK-04-zero-bypass-visible',
      'Bypass state is observable and contains zero bypass actors.',
      Array.isArray(observed.bypass_actors) && observed.bypass_actors.length === 0,
      {
        observable: Array.isArray(observed.bypass_actors),
        count: Array.isArray(observed.bypass_actors) ? observed.bypass_actors.length : null,
      },
    ),
    attack(
      'ATK-05-single-authority-rules',
      'Exactly one pull-request rule and one required-deployments rule exist.',
      rulesOfType(observed, 'pull_request').length === 1
        && rulesOfType(observed, 'required_deployments').length === 1,
      {
        pullRequestRules: rulesOfType(observed, 'pull_request').length,
        requiredDeploymentRules: rulesOfType(observed, 'required_deployments').length,
      },
    ),
    attack(
      'ATK-06-baseline-checks-intact',
      'Every baseline source/proof context remains present.',
      REQUIRED_BASELINE_CONTEXTS.every((context) => observedContexts.includes(context)),
      {
        required: REQUIRED_BASELINE_CONTEXTS,
        observed: observedContexts,
      },
    ),
    attack(
      'ATK-07-candidate-authority-unbound',
      'The reserved candidate runtime context is not prematurely promoted.',
      !observedContexts.includes(RESERVED_CANDIDATE_CONTEXT),
      { reservedContext: RESERVED_CANDIDATE_CONTEXT, observed: observedContexts },
    ),
    attack(
      'ATK-08-required-deployments-intact',
      'Both founder-approved deployment requirements remain present and no extra deployment gate appears.',
      REQUIRED_DEPLOYMENTS.every((name) => observedDeployments.includes(name))
        && observedDeployments.every((name) => REQUIRED_DEPLOYMENTS.includes(name)),
      { required: REQUIRED_DEPLOYMENTS, observed: observedDeployments },
    ),
    attack(
      'ATK-09-founder-review-topology-intact',
      'Founder review remains the authority model without a second-reviewer or last-pusher requirement.',
      Number(observedReview?.required_approving_review_count) === 0
        && observedReview?.dismiss_stale_reviews_on_push !== true
        && observedReview?.require_last_push_approval !== true
        && observedReview?.required_review_thread_resolution === true,
      {
        requiredApprovingReviewCount: Number(observedReview?.required_approving_review_count),
        dismissStaleReviewsOnPush: observedReview?.dismiss_stale_reviews_on_push === true,
        requireLastPushApproval: observedReview?.require_last_push_approval === true,
        requiredReviewThreadResolution: observedReview?.required_review_thread_resolution === true,
      },
    ),
    attack(
      'ATK-10-no-governance-mutation',
      'The accepted desired state is byte-semantically identical to the observed mutable ruleset state.',
      Boolean(desired)
        && same(desired, mutableState(observed))
        && same(desiredReview, observedReview)
        && same(desiredContexts, observedContexts)
        && same(desiredDeployments, observedDeployments),
      {
        desiredPresent: Boolean(desired),
        mutableStatePreserved: Boolean(desired) && same(desired, mutableState(observed)),
        reviewTopologyPreserved: Boolean(desired) && same(desiredReview, observedReview),
        deploymentsPreserved: Boolean(desired) && same(desiredDeployments, observedDeployments),
        statusContextsPreserved: Boolean(desired) && same(desiredContexts, observedContexts),
      },
    ),
  ];

  const passedCount = attacks.filter((item) => item.status === 'passed').length;
  return {
    schemaVersion: 2,
    protocol: 'ultrathink-attack-ten/ruleset-stage1@v2',
    status: passedCount === attacks.length ? 'passed' : 'failed',
    passedCount,
    attackCount: attacks.length,
    attacks,
  };
}
