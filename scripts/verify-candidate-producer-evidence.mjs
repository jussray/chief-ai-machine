import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_VERSION = '2022-11-28';
const GITHUB_ACTIONS_INTEGRATION_ID = 15368;
const REQUIRED_PRODUCER_TRUST = 'external-github-app-check-required';
const REQUIRED_WORKFLOW_PROVENANCE = 'must-not-be-pr-authored-github-actions-only';
const REQUIRED_PRODUCER_EVIDENCE = 'exact-head-check-run-app-identity-required';

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const positiveInteger = (value) => {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
};

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

  const successfulConfiguredChecks = configuredProducerChecks.filter((check) => (
    clean(check?.status).toLowerCase() === 'completed'
    && clean(check?.conclusion).toLowerCase() === 'success'
    && clean(check?.app?.slug).toLowerCase() !== 'github-actions'
  ));

  if (candidateIntegrationId && configuredProducerChecks.length > 0 && successfulConfiguredChecks.length === 0) {
    violations.push({
      classification: 'candidate-check-not-successful',
      context: candidateContext || null,
      expectedIntegrationId: candidateIntegrationId,
      observed: configuredProducerChecks.map((check) => ({
        id: check?.id ?? null,
        status: clean(check?.status) || null,
        conclusion: clean(check?.conclusion) || null,
        appId: positiveInteger(check?.app?.id),
        appSlug: clean(check?.app?.slug) || null,
      })),
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
    successfulConfiguredCheckIds: successfulConfiguredChecks.map((check) => check?.id ?? null),
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

export async function observeCandidateChecks({ repository, token, expectedHeadSha } = {}) {
  const repo = clean(repository);
  const headSha = clean(expectedHeadSha).toLowerCase();
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) throw new Error('repository must be owner/name');
  if (!/^[0-9a-f]{40}$/.test(headSha)) throw new Error('expectedHeadSha must be an exact commit SHA');

  const data = await githubJson(
    `https://api.github.com/repos/${repo}/commits/${headSha}/check-runs?per_page=100`,
    token,
  );
  if (!Array.isArray(data?.check_runs)) throw new Error('GitHub check-runs response was invalid');
  return data.check_runs;
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
  const checks = await observeCandidateChecks({ repository: repo, token, expectedHeadSha: headSha });
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
