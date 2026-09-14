import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProofModeRulesetStage1 } from './compile-proofmode-ruleset-stage1.mjs';

const REPOSITORY = 'jussray/chief-ai-machine';
const RULESET_ID = 20818149;
const MAIN_BRANCH = 'main';
const SOURCE_API_VERSION = '2022-11-28';
const PINNED_EXPECTED_OBSERVED_FINGERPRINT = '5758b4b5aba90895fc3639c4afff2459bc479a13293dc4a589a7829bc0345738';
const PINNED_EXPECTED_DESIRED_FINGERPRINT = PINNED_EXPECTED_OBSERVED_FINGERPRINT;
const DEFAULT_OUTPUT_PATH = 'artifacts/proofmode/ruleset-stage1-apply.json';

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

function assertFingerprint(name, value) {
  const normalized = clean(value).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`${name} must be an exact 64-character sha256 fingerprint.`);
  }
  return normalized;
}

const EXPECTED_OBSERVED_FINGERPRINT = assertFingerprint(
  'PINNED_EXPECTED_OBSERVED_FINGERPRINT',
  PINNED_EXPECTED_OBSERVED_FINGERPRINT,
);
const EXPECTED_DESIRED_FINGERPRINT = assertFingerprint(
  'PINNED_EXPECTED_DESIRED_FINGERPRINT',
  PINNED_EXPECTED_DESIRED_FINGERPRINT,
);

async function githubJson({
  fetchImpl,
  token,
  url,
  apiVersion = SOURCE_API_VERSION,
}) {
  const response = await fetchImpl(url, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': apiVersion,
    },
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
  }
  if (!response.ok) {
    throw new Error(`GitHub ruleset GET failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

function writeReceipt(outputPath, receipt) {
  const absolute = path.resolve(outputPath || DEFAULT_OUTPUT_PATH);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return absolute;
}

function defaultGitProbe() {
  try {
    const head = clean(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).toLowerCase();
    const status = execFileSync(
      'git',
      ['status', '--porcelain=v1', '--untracked-files=all'],
      { encoding: 'utf8' },
    );
    return {
      head,
      cleanCheckout: clean(status) === '',
    };
  } catch (error) {
    throw new Error(
      `Unable to establish local Git source provenance: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function verifyTrustedRulesetRepairSource({
  fetchImpl = globalThis.fetch,
  token,
  gitProbe = defaultGitProbe,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');
  if (!clean(token)) throw new Error('GITHUB_RULESET_ADMIN_TOKEN is required.');

  const local = await gitProbe();
  const localHead = clean(local?.head).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(localHead)) {
    throw new Error('Repair source must resolve to one exact 40-character Git commit SHA.');
  }
  if (local?.cleanCheckout !== true) {
    throw new Error('Repair source checkout must be clean; modified or untracked source is not trusted.');
  }

  const branchUrl = `https://api.github.com/repos/${REPOSITORY}/branches/${MAIN_BRANCH}`;
  const branch = await githubJson({ fetchImpl, token, url: branchUrl });
  const currentMainSha = clean(branch?.commit?.sha).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(currentMainSha)) {
    throw new Error('Could not re-observe current main SHA.');
  }
  if (localHead !== currentMainSha) {
    throw new Error(
      `Repair source is not current protected main. local_head=${localHead} current_main=${currentMainSha}`,
    );
  }

  return {
    branch: MAIN_BRANCH,
    sourceSha: localHead,
    currentMainSha,
    cleanCheckout: true,
  };
}

function verifiedCurrentReceipt({ mode, compiled }) {
  return {
    schemaVersion: 3,
    stage: 'proofmode-ruleset-stage1-apply',
    repository: REPOSITORY,
    rulesetId: RULESET_ID,
    mode,
    status: 'already-applied',
    mutationAttempted: false,
    providerAccepted: false,
    mutated: false,
    outcomeVerified: true,
    observedFingerprint: compiled.observedFingerprint,
    desiredFingerprint: compiled.desiredFingerprint,
    verifiedFingerprint: compiled.observedFingerprint,
    sourceSha: null,
    authority: 'founder-approved-live-ruleset',
  };
}

export function buildProofModeRulesetStage1FailureReceipt({
  env = process.env,
  error,
} = {}) {
  return {
    schemaVersion: 3,
    stage: 'proofmode-ruleset-stage1-apply',
    repository: REPOSITORY,
    rulesetId: RULESET_ID,
    mode: clean(env.PROOFMODE_RULESET_MODE || 'check').toLowerCase(),
    status: 'blocked',
    mutationAttempted: false,
    providerAccepted: false,
    mutated: false,
    outcomeVerified: false,
    sourceSha: null,
    error: error instanceof Error ? error.message : String(error),
  };
}

export async function applyProofModeRulesetStage1({
  env = process.env,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('A fetch implementation is required.');

  const repository = clean(env.GITHUB_REPOSITORY || REPOSITORY);
  if (repository !== REPOSITORY) {
    throw new Error(`Stage 1 is pinned to ${REPOSITORY}; refusing repository ${repository || '<empty>'}.`);
  }

  const mode = clean(env.PROOFMODE_RULESET_MODE || 'check').toLowerCase();
  if (!['check', 'repair'].includes(mode)) {
    throw new Error('PROOFMODE_RULESET_MODE must be check or repair.');
  }

  const token = clean(env.GITHUB_RULESET_ADMIN_TOKEN);
  if (!token) throw new Error('GITHUB_RULESET_ADMIN_TOKEN is required.');

  const apiUrl = `https://api.github.com/repos/${REPOSITORY}/rulesets/${RULESET_ID}`;
  const observedRuleset = await githubJson({ fetchImpl, token, url: apiUrl });
  const compiled = compileProofModeRulesetStage1({ ruleset: observedRuleset, repository: REPOSITORY });

  if (compiled.status === 'blocked') {
    throw new Error(`stage-1 validator blocked live ruleset: ${JSON.stringify(compiled.violations)}`);
  }
  if (compiled.status !== 'already-compliant' || compiled.mutation !== null) {
    throw new Error(`unexpected stage-1 validator disposition: ${compiled.status}`);
  }
  if (
    compiled.observedFingerprint !== EXPECTED_OBSERVED_FINGERPRINT
    || compiled.desiredFingerprint !== EXPECTED_DESIRED_FINGERPRINT
  ) {
    throw new Error(
      `live ruleset fingerprint drifted. observed=${compiled.observedFingerprint} desired=${compiled.desiredFingerprint} expected=${EXPECTED_OBSERVED_FINGERPRINT}`,
    );
  }

  return verifiedCurrentReceipt({ mode, compiled });
}

export async function runProofModeRulesetStage1Cli(env = process.env) {
  const outputPath = clean(env.PROOFMODE_RULESET_RECEIPT_PATH) || DEFAULT_OUTPUT_PATH;
  try {
    const receipt = await applyProofModeRulesetStage1({ env });
    const written = writeReceipt(outputPath, receipt);
    console.log(JSON.stringify({ ...receipt, receiptPath: written }, null, 2));
    return receipt;
  } catch (error) {
    const failure = buildProofModeRulesetStage1FailureReceipt({ env, error });
    const written = writeReceipt(outputPath, failure);
    console.error(JSON.stringify({ ...failure, receiptPath: written }, null, 2));
    throw error;
  }
}

export const PROOFMODE_RULESET_STAGE1 = Object.freeze({
  repository: REPOSITORY,
  rulesetId: RULESET_ID,
  expectedObservedFingerprint: EXPECTED_OBSERVED_FINGERPRINT,
  expectedDesiredFingerprint: EXPECTED_DESIRED_FINGERPRINT,
  mutationPolicy: 'disabled-current-ruleset-approved',
  repairSource: 'clean-current-main-only',
});

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  runProofModeRulesetStage1Cli().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
