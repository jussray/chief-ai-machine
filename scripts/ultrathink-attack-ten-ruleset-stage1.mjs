const RULESET_ID = 20818149;
const RULESET_NAME = 'Chief AI main exact-head gate';
const RESERVED_CANDIDATE_CONTEXT = 'Verify candidate ProofMode runtime with Playwright';
const POST_MERGE_ONLY_DEPLOYMENT = 'Cloudflare Production';
const PRESERVED_ADMIN_DEPLOYMENT = 'proofmode-access-admin';
const REQUIRED_BASELINE_CONTEXTS = Object.freeze([
  'Typecheck',
  'Lint',
  'Unit Tests',
  'SonarQube – Founder Intelligence',
  'Verify test-ledger contract',
]);

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const clone = (value) => JSON.parse(JSON.stringify(value));

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

function allowedDeltaOnly(observed, desired) {
  if (!desired || typeof desired !== 'object') return false;

  const normalized = clone(desired);
  const observedMutable = mutableState(observed);
  const observedDeployments = rulesOfType(observedMutable, 'required_deployments')[0];
  const desiredDeployments = rulesOfType(normalized, 'required_deployments')[0];

  if (!observedDeployments || !desiredDeployments) return false;

  desiredDeployments.parameters.required_deployment_environments = clone(
    observedDeployments.parameters?.required_deployment_environments || [],
  );

  return same(normalized, observedMutable);
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
      'The proposal targets only the zero-bypass Chief exact-head ruleset carrier.',
      observed.id === RULESET_ID && clean(observed.name) === RULESET_NAME,
      { observedId: observed.id ?? null, observedName: clean(observed.name) || null },
    ),
    attack(
      'ATK-02-active-branch-carrier',
      'The carrier is an active branch ruleset rather than an inert or differently scoped object.',
      observed.target === 'branch' && observed.enforcement === 'active',
      { target: observed.target ?? null, enforcement: observed.enforcement ?? null },
    ),
    attack(
      'ATK-03-default-branch-scope',
      'The carrier still protects the default branch and does not exclude it.',
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
      'Exactly one pull-request rule and one required-deployments rule exist, avoiding ambiguous mutation targets.',
      rulesOfType(observed, 'pull_request').length === 1
        && rulesOfType(observed, 'required_deployments').length === 1,
      {
        pullRequestRules: rulesOfType(observed, 'pull_request').length,
        requiredDeploymentRules: rulesOfType(observed, 'required_deployments').length,
      },
    ),
    attack(
      'ATK-06-baseline-checks-intact',
      'Every baseline source/proof context remains present before governance is changed.',
      REQUIRED_BASELINE_CONTEXTS.every((context) => observedContexts.includes(context)),
      {
        required: REQUIRED_BASELINE_CONTEXTS,
        observed: observedContexts,
      },
    ),
    attack(
      'ATK-07-candidate-authority-unbound',
      'The reserved candidate runtime context is not prematurely promoted to required authority.',
      !observedContexts.includes(RESERVED_CANDIDATE_CONTEXT),
      { reservedContext: RESERVED_CANDIDATE_CONTEXT, observed: observedContexts },
    ),
    attack(
      'ATK-08-admin-deployment-preserved',
      'The protected proofmode-access-admin deployment remains required before any stage-1 proposal is emitted.',
      observedDeployments.includes(PRESERVED_ADMIN_DEPLOYMENT),
      { required: PRESERVED_ADMIN_DEPLOYMENT, observed: observedDeployments },
    ),
    attack(
      'ATK-09-proposal-preserves-unrelated-authority',
      'The desired proposal preserves conditions, bypass actors, required status checks, and pull-request review topology exactly.',
      Boolean(desired)
        && same(desired.conditions, observed.conditions)
        && same(desired.bypass_actors, observed.bypass_actors)
        && same(statusChecks(desired), statusChecks(observed))
        && same(desiredReview, observedReview),
      {
        proposalPresent: Boolean(desired),
        conditionsPreserved: Boolean(desired) && same(desired.conditions, observed.conditions),
        bypassPreserved: Boolean(desired) && same(desired.bypass_actors, observed.bypass_actors),
        statusChecksPreserved: Boolean(desired) && same(statusChecks(desired), statusChecks(observed)),
        reviewTopologyPreserved: Boolean(desired) && same(desiredReview, observedReview),
      },
    ),
    attack(
      'ATK-10-founder-review-compatible-delta',
      'The only mutation delta removes the post-merge-only production deployment while preserving founder review authority and admin protection.',
      Boolean(desired)
        && allowedDeltaOnly(observed, desired)
        && Number(observedReview?.required_approving_review_count) === 0
        && observedReview?.dismiss_stale_reviews_on_push !== true
        && observedReview?.require_last_push_approval !== true
        && observedReview?.required_review_thread_resolution === true
        && same(desiredReview, observedReview)
        && !desiredDeployments.includes(POST_MERGE_ONLY_DEPLOYMENT)
        && desiredDeployments.includes(PRESERVED_ADMIN_DEPLOYMENT)
        && !desiredContexts.includes(RESERVED_CANDIDATE_CONTEXT),
      {
        proposalPresent: Boolean(desired),
        allowedDeltaOnly: Boolean(desired) && allowedDeltaOnly(observed, desired),
        founderReviewCompatible: Number(observedReview?.required_approving_review_count) === 0
          && observedReview?.require_last_push_approval !== true,
        reviewTopologyPreserved: Boolean(desired) && same(desiredReview, observedReview),
        deployments: desiredDeployments,
        reservedCandidateContextRequired: desiredContexts.includes(RESERVED_CANDIDATE_CONTEXT),
      },
    ),
  ];

  const passedCount = attacks.filter((item) => item.status === 'passed').length;
  return {
    schemaVersion: 1,
    protocol: 'ultrathink-attack-ten/ruleset-stage1@v1',
    status: passedCount === attacks.length ? 'passed' : 'failed',
    passedCount,
    attackCount: attacks.length,
    attacks,
  };
}
