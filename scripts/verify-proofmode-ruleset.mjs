import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = '2022-11-28';
const GITHUB_ACTIONS_INTEGRATION_ID = 15368;
const REQUIRED_CANDIDATE_PRODUCER_TRUST = 'external-github-app-check-required';
const REQUIRED_CANDIDATE_WORKFLOW_PROVENANCE = 'must-not-be-pr-authored-github-actions-only';

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

export function rulesetTargetsDefaultBranch(ruleset, defaultBranch = 'main') {
  if (!ruleset || ruleset.target !== 'branch' || ruleset.enforcement !== 'active') return false;

  const refName = ruleset.conditions?.ref_name;
  const include = Array.isArray(refName?.include) ? refName.include : [];
  const exclude = Array.isArray(refName?.exclude) ? refName.exclude : [];
  const exactRef = `refs/heads/${defaultBranch}`;

  if (exclude.includes('~DEFAULT_BRANCH') || exclude.includes(exactRef)) return false;
  return include.includes('~DEFAULT_BRANCH') || include.includes(exactRef);
}

export function requiredStatusChecks(ruleset) {
  const rules = Array.isArray(ruleset?.rules) ? ruleset.rules : [];
  const checks = [];

  for (const rule of rules) {
    if (rule?.type !== 'required_status_checks') continue;
    const required = Array.isArray(rule?.parameters?.required_status_checks)
      ? rule.parameters.required_status_checks
      : [];
    for (const check of required) {
      const context = clean(check?.context);
      if (!context) continue;
      const integrationId = Number(check?.integration_id);
      checks.push({
        context,
        integrationId: Number.isSafeInteger(integrationId) && integrationId > 0 ? integrationId : null,
      });
    }
  }

  const seen = new Set();
  return checks.filter((check) => {
    const key = `${check.context}\u0000${check.integrationId ?? 'unbound'}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function requiredStatusContexts(ruleset) {
  return [...new Set(requiredStatusChecks(ruleset).map((check) => check.context))];
}

export function requiredDeploymentEnvironments(ruleset) {
  const rules = Array.isArray(ruleset?.rules) ? ruleset.rules : [];
  const environments = [];
  for (const rule of rules) {
    if (rule?.type !== 'required_deployments') continue;
    const required = Array.isArray(rule?.parameters?.required_deployment_environments)
      ? rule.parameters.required_deployment_environments
      : [];
    environments.push(...required.map(clean).filter(Boolean));
  }
  return [...new Set(environments)];
}

export function validateProofModeRulesetMigration({
  rulesets,
  semantics,
  defaultBranch = 'main',
} = {}) {
  const observed = Array.isArray(rulesets) ? rulesets : [];
  const activeDefaultBranchRulesets = observed.filter((ruleset) => (
    rulesetTargetsDefaultBranch(ruleset, defaultBranch)
  ));
  const legacyContexts = Array.isArray(semantics?.legacyPreMergeProofModeContexts)
    ? semantics.legacyPreMergeProofModeContexts.map(clean).filter(Boolean)
    : [];
  const postMergeOnlyDeploymentEnvironments = Array.isArray(semantics?.postMergeOnlyDeploymentEnvironments)
    ? semantics.postMergeOnlyDeploymentEnvironments.map(clean).filter(Boolean)
    : [];
  const candidateContext = clean(semantics?.preMergeCandidateContext);
  const candidateIntegrationId = Number(semantics?.preMergeCandidateIntegrationId);
  const candidateIntegrationValid = Number.isSafeInteger(candidateIntegrationId) && candidateIntegrationId > 0;
  const candidateRulesetId = Number(semantics?.preMergeCandidateRulesetId);
  const candidateRulesetValid = Number.isSafeInteger(candidateRulesetId) && candidateRulesetId > 0;
  const candidateRulesetName = clean(semantics?.preMergeCandidateRulesetName) || null;
  const candidateMustHaveNoBypassActors = semantics?.preMergeCandidateRulesetMustHaveNoBypassActors === true;
  const candidateProducerTrust = clean(semantics?.preMergeCandidateProducerTrust);
  const candidateWorkflowProvenance = clean(semantics?.preMergeCandidateWorkflowProvenance);
  const producerContractValid = (
    candidateProducerTrust === REQUIRED_CANDIDATE_PRODUCER_TRUST
    && candidateWorkflowProvenance === REQUIRED_CANDIDATE_WORKFLOW_PROVENANCE
  );
  const candidateUsesGithubActions = candidateIntegrationValid
    && candidateIntegrationId === GITHUB_ACTIONS_INTEGRATION_ID;
  const violations = [];

  if (activeDefaultBranchRulesets.length === 0) {
    violations.push({
      classification: 'default-branch-ruleset-not-observed',
      defaultBranch,
      reason: 'no active branch ruleset targeting the default branch was observed',
    });
  }

  if (
    legacyContexts.length === 0
    || !candidateContext
    || !candidateIntegrationValid
    || !candidateRulesetValid
    || !candidateMustHaveNoBypassActors
    || !producerContractValid
  ) {
    violations.push({
      classification: 'proofmode-ruleset-contract-incomplete',
      legacyContexts,
      candidateContext: candidateContext || null,
      candidateIntegrationId: candidateIntegrationValid ? candidateIntegrationId : null,
      candidateRulesetId: candidateRulesetValid ? candidateRulesetId : null,
      candidateRulesetMustHaveNoBypassActors: candidateMustHaveNoBypassActors,
      candidateProducerTrust: candidateProducerTrust || null,
      candidateWorkflowProvenance: candidateWorkflowProvenance || null,
    });
  }

  if (producerContractValid && candidateUsesGithubActions) {
    violations.push({
      classification: 'candidate-proofmode-producer-untrusted',
      context: candidateContext || null,
      integrationId: candidateIntegrationId,
      producerTrust: candidateProducerTrust,
      workflowProvenance: candidateWorkflowProvenance,
      reason: 'GitHub Actions can be invoked by PR-authored workflow code and cannot be the sole external candidate-proof producer',
    });
  }

  const requiredByRuleset = activeDefaultBranchRulesets.map((ruleset) => {
    const checks = requiredStatusChecks(ruleset);
    const deployments = requiredDeploymentEnvironments(ruleset);
    const bypassActorsObservable = Array.isArray(ruleset?.bypass_actors);
    const bypassActorCount = bypassActorsObservable ? ruleset.bypass_actors.length : null;
    return {
      id: ruleset.id ?? null,
      name: clean(ruleset.name) || null,
      contexts: [...new Set(checks.map((check) => check.context))],
      checks,
      requiredDeploymentEnvironments: deployments,
      bypassActorCount,
      bypassActorState: bypassActorsObservable ? 'observed' : 'unobservable',
    };
  });

  for (const legacyContext of legacyContexts) {
    const blockers = requiredByRuleset
      .filter((ruleset) => ruleset.contexts.includes(legacyContext))
      .map(({ id, name }) => ({ id, name }));
    if (blockers.length > 0) {
      violations.push({
        classification: 'legacy-proofmode-context-still-required',
        context: legacyContext,
        rulesets: blockers,
      });
    }
  }

  for (const environment of postMergeOnlyDeploymentEnvironments) {
    const blockers = requiredByRuleset
      .filter((ruleset) => ruleset.requiredDeploymentEnvironments.includes(environment))
      .map(({ id, name }) => ({ id, name }));
    if (blockers.length > 0) {
      violations.push({
        classification: 'postmerge-only-deployment-required-premerge',
        environment,
        rulesets: blockers,
        reason: 'a production-plane deployment environment is required by a default-branch merge ruleset before merge',
      });
    }
  }

  const candidateOccurrences = requiredByRuleset.flatMap((ruleset) => (
    ruleset.checks
      .filter((check) => check.context === candidateContext)
      .map((check) => ({
        id: ruleset.id,
        name: ruleset.name,
        integrationId: check.integrationId,
        bypassActorCount: ruleset.bypassActorCount,
        bypassActorState: ruleset.bypassActorState,
      }))
  ));

  if (candidateContext && candidateOccurrences.length === 0) {
    violations.push({
      classification: 'candidate-proofmode-context-not-required',
      context: candidateContext,
    });
  }

  const integrationMismatches = candidateIntegrationValid
    ? candidateOccurrences.filter((entry) => entry.integrationId !== candidateIntegrationId)
    : [];
  if (integrationMismatches.length > 0) {
    violations.push({
      classification: 'candidate-proofmode-integration-mismatch',
      context: candidateContext,
      expectedIntegrationId: candidateIntegrationId,
      observed: integrationMismatches,
    });
  }

  const rulesetMismatches = candidateRulesetValid
    ? candidateOccurrences.filter((entry) => entry.id !== candidateRulesetId)
    : [];
  if (rulesetMismatches.length > 0) {
    violations.push({
      classification: 'candidate-proofmode-ruleset-mismatch',
      context: candidateContext,
      expectedRulesetId: candidateRulesetId,
      expectedRulesetName: candidateRulesetName,
      observed: rulesetMismatches,
    });
  }

  const authoritativeOccurrences = candidateRulesetValid
    ? candidateOccurrences.filter((entry) => entry.id === candidateRulesetId)
    : [];
  if (candidateContext && candidateRulesetValid && authoritativeOccurrences.length === 0) {
    violations.push({
      classification: 'candidate-proofmode-authoritative-ruleset-not-required',
      context: candidateContext,
      expectedRulesetId: candidateRulesetId,
      expectedRulesetName: candidateRulesetName,
    });
  }

  const unobservableBypassOccurrences = candidateMustHaveNoBypassActors
    ? authoritativeOccurrences.filter((entry) => entry.bypassActorCount === null)
    : [];
  if (unobservableBypassOccurrences.length > 0) {
    violations.push({
      classification: 'candidate-proofmode-bypass-state-unobservable',
      context: candidateContext,
      expectedRulesetId: candidateRulesetId,
      reason: 'ruleset response did not expose bypass_actors; trusted administration readback is required',
      observed: unobservableBypassOccurrences,
    });
  }

  const bypassableOccurrences = candidateMustHaveNoBypassActors
    ? authoritativeOccurrences.filter((entry) => Number.isInteger(entry.bypassActorCount) && entry.bypassActorCount > 0)
    : [];
  if (bypassableOccurrences.length > 0) {
    violations.push({
      classification: 'candidate-proofmode-ruleset-bypassable',
      context: candidateContext,
      expectedRulesetId: candidateRulesetId,
      observed: bypassableOccurrences,
    });
  }

  const candidateRulesets = candidateIntegrationValid && candidateRulesetValid && producerContractValid
    ? authoritativeOccurrences
      .filter((entry) => (
        entry.integrationId === candidateIntegrationId
        && entry.bypassActorCount === 0
        && entry.integrationId !== GITHUB_ACTIONS_INTEGRATION_ID
      ))
      .map(({ id, name }) => ({ id, name }))
    : [];

  return {
    defaultBranch,
    legacyContexts,
    postMergeOnlyDeploymentEnvironments,
    candidateContext: candidateContext || null,
    candidateIntegrationId: candidateIntegrationValid ? candidateIntegrationId : null,
    candidateRulesetId: candidateRulesetValid ? candidateRulesetId : null,
    candidateRulesetName,
    candidateRulesetMustHaveNoBypassActors: candidateMustHaveNoBypassActors,
    candidateProducerTrust: candidateProducerTrust || null,
    candidateWorkflowProvenance: candidateWorkflowProvenance || null,
    activeDefaultBranchRulesets: requiredByRuleset,
    candidateRulesets,
    violations,
    ok: violations.length === 0,
  };
}

async function githubJson(url, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'chief-operational-authority',
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub ruleset read failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function observeRepositoryRulesets({ repository, token } = {}) {
  const repo = clean(repository);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error('repository must be owner/name');
  }

  const base = `https://api.github.com/repos/${repo}`;
  const summaries = await githubJson(`${base}/rulesets?includes_parents=true&per_page=100`, token);
  if (!Array.isArray(summaries)) throw new Error('GitHub ruleset list was not an array');

  const detailed = [];
  for (const summary of summaries) {
    const id = Number(summary?.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new Error('GitHub ruleset list contained an invalid ruleset id');
    }
    detailed.push(await githubJson(`${base}/rulesets/${id}`, token));
  }
  return detailed;
}

export async function writeProofModeRulesetReport({
  rootDir = process.cwd(),
  outputPath = 'artifacts/proofmode-ruleset-report.json',
  repository = process.env.GITHUB_REPOSITORY,
  token = process.env.GITHUB_TOKEN,
} = {}) {
  const configPath = path.join(rootDir, 'config', 'operational-authority.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const repo = clean(repository) || clean(config?.truthSource?.repository);
  const defaultBranch = clean(config?.truthSource?.branch) || 'main';
  const rulesets = await observeRepositoryRulesets({ repository: repo, token });
  const validation = validateProofModeRulesetMigration({
    rulesets,
    semantics: config?.proofContextSemantics,
    defaultBranch,
  });
  const report = {
    schemaVersion: 1,
    project: config?.project || null,
    repository: repo,
    observedRulesets: rulesets.map((ruleset) => {
      const bypassActorsObservable = Array.isArray(ruleset?.bypass_actors);
      return {
        id: ruleset?.id ?? null,
        name: clean(ruleset?.name) || null,
        enforcement: clean(ruleset?.enforcement) || null,
        target: clean(ruleset?.target) || null,
        requiredDeploymentEnvironments: requiredDeploymentEnvironments(ruleset),
        bypassActorCount: bypassActorsObservable ? ruleset.bypass_actors.length : null,
        bypassActorState: bypassActorsObservable ? 'observed' : 'unobservable',
      };
    }),
    ...validation,
  };

  const absoluteOutput = path.resolve(rootDir, outputPath);
  fs.mkdirSync(path.dirname(absoluteOutput), { recursive: true });
  fs.writeFileSync(absoluteOutput, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  return report;
}

const isDirectExecution = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  try {
    const report = await writeProofModeRulesetReport();
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`ProofMode ruleset observation failed closed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
