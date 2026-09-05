import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = '2022-11-28';

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

export function requiredStatusContexts(ruleset) {
  const rules = Array.isArray(ruleset?.rules) ? ruleset.rules : [];
  const contexts = [];

  for (const rule of rules) {
    if (rule?.type !== 'required_status_checks') continue;
    const checks = Array.isArray(rule?.parameters?.required_status_checks)
      ? rule.parameters.required_status_checks
      : [];
    for (const check of checks) {
      const context = clean(check?.context);
      if (context) contexts.push(context);
    }
  }

  return [...new Set(contexts)];
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
  const candidateContext = clean(semantics?.preMergeCandidateContext);
  const violations = [];

  if (activeDefaultBranchRulesets.length === 0) {
    violations.push({
      classification: 'default-branch-ruleset-not-observed',
      defaultBranch,
      reason: 'no active branch ruleset targeting the default branch was observed',
    });
  }

  if (legacyContexts.length === 0 || !candidateContext) {
    violations.push({
      classification: 'proofmode-ruleset-contract-incomplete',
      legacyContexts,
      candidateContext: candidateContext || null,
    });
  }

  const requiredByRuleset = activeDefaultBranchRulesets.map((ruleset) => ({
    id: ruleset.id ?? null,
    name: clean(ruleset.name) || null,
    contexts: requiredStatusContexts(ruleset),
  }));

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

  const candidateRulesets = requiredByRuleset
    .filter((ruleset) => ruleset.contexts.includes(candidateContext))
    .map(({ id, name }) => ({ id, name }));
  if (candidateContext && candidateRulesets.length === 0) {
    violations.push({
      classification: 'candidate-proofmode-context-not-required',
      context: candidateContext,
    });
  }

  return {
    defaultBranch,
    legacyContexts,
    candidateContext: candidateContext || null,
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
    observedRulesets: rulesets.map((ruleset) => ({
      id: ruleset?.id ?? null,
      name: clean(ruleset?.name) || null,
      enforcement: clean(ruleset?.enforcement) || null,
      target: clean(ruleset?.target) || null,
    })),
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
