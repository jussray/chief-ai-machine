import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = '2022-11-28';
const GITHUB_ACTIONS_INTEGRATION_ID = 15368;
const REQUIRED_PRODUCER_TRUST = 'external-github-app-check-required';
const REQUIRED_WORKFLOW_PROVENANCE = 'must-not-be-pr-authored-github-actions-only';
const REQUIRED_PRODUCER_EVIDENCE = 'exact-head-check-run-app-identity-required';
const CHECK_RUNS_PER_PAGE = 100;
const MAX_CHECK_RUN_PAGES = 100;

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const positiveInteger = (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

function checkStartedAtMs(check) {
  const value = Date.parse(clean(check?.started_at));
  return Number.isFinite(value) ? value : null;
}

function latestCheck(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return null;
  return [...checks].sort((left, right) => {
    const leftStarted = checkStartedAtMs(left);
    const rightStarted = checkStartedAtMs(right);
    if (leftStarted !== null && rightStarted !== null && leftStarted !== rightStarted) {
      return rightStarted - leftStarted;
    }
    return 0;
  })[0];
}

export function evaluateCandidateProducerEvidence({
  checks,
  semantics,
  expectedHeadSha,
} = {}) {
  const headSha = clean(expectedHeadSha).toLowerCase();
  const candidateContext = clean(semantics?.preMergeCandidateContext);
  const candidateIntegrationId = positiveInteger(semantics?.preMergeCandidateIntegrationId);
  const producerTrust = clean(semantics?.preMergeCandidateProducerTrust);
  const workflowProvenance = clean(semantics?.preMergeCandidateWorkflowProvenance);
  const producerEvidence = clean(semantics?.preMergeCandidateProducerEvidence);
  const violations = [];

  if (!/^[0-9a-f]{40}$/.test(headSha)) {
    violations.push({
      classification: 'candidate-head-invalid',
      expectedHeadSha: headSha || null,
    });
  }

  if (
    !candidateContext
    || !candidateIntegrationId
    || producerTrust !== REQUIRED_PRODUCER_TRUST
    || workflowProvenance !== REQUIRED_WORKFLOW_PROVENANCE
    || producerEvidence !== REQUIRED_PRODUCER_EVIDENCE
  ) {
    violations.push({
      classification: 'candidate-producer-contract-incomplete',
      candidateContext: candidateContext || null,
      candidateIntegrationId,
      producerTrust: producerTrust || null,
      workflowProvenance: workflowProvenance || null,
      producerEvidence: producerEvidence || null,
    });
  }

  if (candidateIntegrationId === GITHUB_ACTIONS_INTEGRATION_ID) {
    violations.push({
      classification: 'candidate-producer-github-actions-forbidden',
      integrationId: candidateIntegrationId,
      reason: 'PR-authored GitHub Actions cannot be the sole candidate-proof trust root',
    });
  }

  const list = Array.isArray(checks) ? checks : [];
  const exactContextChecks = /^[0-9a-f]{40}$/.test(headSha) && candidateContext
    ? list.filter((check) => (
      clean(check?.name) === candidateContext
      && clean(check?.head_sha).toLowerCase() === headSha
    ))
    : [];

  if (exactContextChecks.length === 0) {
    violations.push({
      classification: 'candidate-check-not-observed',
      context: candidateContext || null,
      expectedHeadSha: headSha || null,
    });
  }

  const producerIdentityUnobservable = exactContextChecks.filter((check) => (
    !positiveInteger(check?.app?.id)
  ));
  if (producerIdentityUnobservable.length > 0) {
    violations.push({
      classification: 'candidate-check-producer-unobservable',
      context: candidateContext || null,
      count: producerIdentityUnobservable.length,
      checkIds: producerIdentityUnobservable.map((check) => positiveInteger(check?.id)),
      reason: 'every authoritative candidate-context check must expose a GitHub App integration id',
    });
  }

  const observedProducerIds = [...new Set(
    exactContextChecks
      .map((check) => positiveInteger(check?.app?.id))
      .filter(Boolean),
  )];

  if (observedProducerIds.length > 1) {
    violations.push({
      classification: 'candidate-check-producer-ambiguous',
      context: candidateContext || null,
      expectedHeadSha: headSha || null,
      observedProducerIds,
      reason: 'the candidate context was emitted by more than one GitHub App identity on the exact head',
    });
  }

  const configuredProducerChecks = candidateIntegrationId
    ? exactContextChecks.filter((check) => positiveInteger(check?.app?.id) === candidateIntegrationId)
    : [];

  if (candidateIntegrationId && exactContextChecks.length > 0 && configuredProducerChecks.length === 0) {
    violations.push({
      classification: 'candidate-check-producer-mismatch',
      context: candidateContext || null,
      expectedIntegrationId: candidateIntegrationId,
      observedProducerIds,
    });
  }

  const githubActionsChecks = exactContextChecks.filter((check) => (
    positiveInteger(check?.app?.id) === GITHUB_ACTIONS_INTEGRATION_ID
    || clean(check?.app?.slug).toLowerCase() === 'github-actions'
  ));
  if (githubActionsChecks.length > 0) {
    violations.push({
      classification: 'candidate-context-emitted-by-github-actions',
      context: candidateContext || null,
      count: githubActionsChecks.length,
      reason: 'candidate proof must not share its authoritative context with PR-authored GitHub Actions',
    });
  }

  const orderingUnobservableChecks = configuredProducerChecks.filter((check) => (
    checkStartedAtMs(check) === null
  ));
  const orderingUnobservable = configuredProducerChecks.length > 1
    && orderingUnobservableChecks.length > 0;
  if (orderingUnobservable) {
    violations.push({
      classification: 'candidate-check-order-unobservable',
      context: candidateContext || null,
      expectedIntegrationId: candidateIntegrationId,
      checkIds: configuredProducerChecks.map((check) => positiveInteger(check?.id)),
      missingStartedAtCheckIds: orderingUnobservableChecks.map((check) => positiveInteger(check?.id)),
      reason: 'duplicate candidate checks cannot be ordered safely while any run lacks started_at',
    });
  }

  const startedAtCounts = new Map();
  for (const check of configuredProducerChecks) {
    const startedAt = checkStartedAtMs(check);
    if (startedAt === null) continue;
    startedAtCounts.set(startedAt, (startedAtCounts.get(startedAt) || 0) + 1);
  }
  const ambiguousStartedAt = [...startedAtCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([startedAt]) => new Date(startedAt).toISOString());
  const orderingAmbiguous = configuredProducerChecks.length > 1
    && ambiguousStartedAt.length > 0;
  if (orderingAmbiguous) {
    violations.push({
      classification: 'candidate-check-order-ambiguous',
      context: candidateContext || null,
      expectedIntegrationId: candidateIntegrationId,
      checkIds: configuredProducerChecks.map((check) => positiveInteger(check?.id)),
      duplicateStartedAt: ambiguousStartedAt,
      reason: 'duplicate candidate checks sharing started_at cannot be safely ordered by check id',
    });
  }

  const orderingBlocked = orderingUnobservable || orderingAmbiguous;
  const currentConfiguredCheck = orderingBlocked
    ? null
    : latestCheck(configuredProducerChecks);
  const currentConfiguredCheckIsSuccessful = Boolean(currentConfiguredCheck)
    && clean(currentConfiguredCheck?.status).toLowerCase() === 'completed'
    && clean(currentConfiguredCheck?.conclusion).toLowerCase() === 'success'
    && clean(currentConfiguredCheck?.app?.slug).toLowerCase() !== 'github-actions';

  if (candidateIntegrationId && configuredProducerChecks.length > 0 && !currentConfiguredCheckIsSuccessful) {
    violations.push({
      classification: 'candidate-check-not-successful',
      context: candidateContext || null,
      expectedIntegrationId: candidateIntegrationId,
      current: {
        id: currentConfiguredCheck?.id ?? null,
        startedAt: clean(currentConfiguredCheck?.started_at) || null,
        status: clean(currentConfiguredCheck?.status) || null,
        conclusion: clean(currentConfiguredCheck?.conclusion) || null,
        appId: positiveInteger(currentConfiguredCheck?.app?.id),
        appSlug: clean(currentConfiguredCheck?.app?.slug) || null,
      },
      observedRunCount: configuredProducerChecks.length,
    });
  }

  return {
    expectedHeadSha: headSha || null,
    candidateContext: candidateContext || null,
    candidateIntegrationId,
    producerTrust: producerTrust || null,
    workflowProvenance: workflowProvenance || null,
    producerEvidence: producerEvidence || null,
    observedProducerIds,
    exactContextCheckCount: exactContextChecks.length,
    currentConfiguredCheckId: currentConfiguredCheck?.id ?? null,
    successfulConfiguredCheckIds: currentConfiguredCheckIsSuccessful
      ? [currentConfiguredCheck?.id ?? null]
      : [],
    violations,
    ok: violations.length === 0,
  };
}

async function githubJson(url, token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': API_VERSION,
    'User-Agent': 'chief-candidate-producer-evidence',
  };
  if (clean(token)) headers.Authorization = `Bearer ${clean(token)}`;

  const response = await fetch(url, { headers });
  if (!response.ok) {
    throw new Error(`GitHub candidate check read failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function observeCandidateChecks({
  repository,
  token,
  expectedHeadSha,
  checkName,
} = {}) {
  const repo = clean(repository);
  const headSha = clean(expectedHeadSha).toLowerCase();
  const requestedCheckName = clean(checkName);
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) throw new Error('repository must be owner/name');
  if (!/^[0-9a-f]{40}$/.test(headSha)) throw new Error('expectedHeadSha must be an exact commit SHA');

  const checks = [];
  for (let page = 1; page <= MAX_CHECK_RUN_PAGES; page += 1) {
    const params = new URLSearchParams({
      filter: 'all',
      per_page: String(CHECK_RUNS_PER_PAGE),
      page: String(page),
    });
    if (requestedCheckName) params.set('check_name', requestedCheckName);

    const data = await githubJson(
      `https://api.github.com/repos/${repo}/commits/${headSha}/check-runs?${params.toString()}`,
      token,
    );
    if (!Array.isArray(data?.check_runs)) throw new Error('GitHub check-runs response was invalid');

    checks.push(...data.check_runs);
    if (data.check_runs.length < CHECK_RUNS_PER_PAGE) return checks;
  }

  throw new Error(`GitHub candidate check pagination exceeded ${MAX_CHECK_RUN_PAGES} pages`);
}

export async function writeCandidateProducerEvidenceReport({
  rootDir = process.cwd(),
  outputPath = 'artifacts/candidate-producer-evidence-report.json',
  repository = process.env.GITHUB_REPOSITORY,
  token = process.env.GITHUB_TOKEN,
  expectedHeadSha = process.env.EXPECTED_HEAD_SHA,
} = {}) {
  const configPath = path.join(rootDir, 'config', 'operational-authority.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const repo = clean(repository) || clean(config?.truthSource?.repository);
  const headSha = clean(expectedHeadSha).toLowerCase();
  const candidateContext = clean(config?.proofContextSemantics?.preMergeCandidateContext);
  const checks = await observeCandidateChecks({
    repository: repo,
    token,
    expectedHeadSha: headSha,
    checkName: candidateContext,
  });
  const report = {
    schemaVersion: 1,
    project: config?.project || null,
    repository: repo,
    ...evaluateCandidateProducerEvidence({
      checks,
      semantics: config?.proofContextSemantics,
      expectedHeadSha: headSha,
    }),
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
    const report = await writeCandidateProducerEvidenceReport();
    if (!report.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`Candidate producer evidence observation failed closed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
