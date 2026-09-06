import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileProofModeRulesetStage1 } from './compile-proofmode-ruleset-stage1.mjs';

const REPOSITORY = 'jussray/chief-ai-machine';
const RULESET_ID = 20818149;
const DEFAULT_EXPECTED_OBSERVED_FINGERPRINT = '5758b4b5aba90895fc3639c4afff2459bc479a13293dc4a589a7829bc0345738';
const DEFAULT_EXPECTED_DESIRED_FINGERPRINT = 'f337fd4a3a0c2eab9e913c76381046dbf8e581b8ec76e90f06a221142b668dd7';
const REPAIR_CONFIRMATION = 'apply-proofmode-ruleset-stage1';
const DEFAULT_OUTPUT_PATH = 'artifacts/proofmode/ruleset-stage1-apply.json';

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

function assertFingerprint(name, value) {
  const normalized = clean(value).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(normalized)) {
    throw new Error(`${name} must be an exact 64-character sha256 fingerprint.`);
  }
  return normalized;
}

async function githubJson({ fetchImpl, token, method = 'GET', url, body = null, apiVersion = '2026-03-10' }) {
  const response = await fetchImpl(url, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': apiVersion,
    },
    body: body == null ? undefined : JSON.stringify(body),
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
    throw new Error(`GitHub ruleset ${method} failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload;
}

function writeReceipt(outputPath, receipt) {
  const absolute = path.resolve(outputPath || DEFAULT_OUTPUT_PATH);
  fs.mkdirSync(path.dirname(absolute), { recursive: true });
  fs.writeFileSync(absolute, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  return absolute;
}

export async function applyProofModeRulesetStage1({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
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

  const expectedObservedFingerprint = assertFingerprint(
    'PROOFMODE_RULESET_EXPECTED_OBSERVED_FINGERPRINT',
    env.PROOFMODE_RULESET_EXPECTED_OBSERVED_FINGERPRINT || DEFAULT_EXPECTED_OBSERVED_FINGERPRINT,
  );
  const expectedDesiredFingerprint = assertFingerprint(
    'PROOFMODE_RULESET_EXPECTED_DESIRED_FINGERPRINT',
    env.PROOFMODE_RULESET_EXPECTED_DESIRED_FINGERPRINT || DEFAULT_EXPECTED_DESIRED_FINGERPRINT,
  );

  const apiUrl = `https://api.github.com/repos/${REPOSITORY}/rulesets/${RULESET_ID}`;
  const observedRuleset = await githubJson({ fetchImpl, token, url: apiUrl });
  const compiled = compileProofModeRulesetStage1({ ruleset: observedRuleset, repository: REPOSITORY });

  if (compiled.status === 'blocked') {
    throw new Error(`Stage-1 compiler blocked live ruleset: ${JSON.stringify(compiled.violations)}`);
  }

  if (compiled.status === 'already-compliant') {
    if (
      compiled.observedFingerprint !== expectedDesiredFingerprint
      || compiled.desiredFingerprint !== expectedDesiredFingerprint
    ) {
      throw new Error(
        `Live ruleset is compliant but does not equal the pinned desired fingerprint. observed=${compiled.observedFingerprint} desired=${compiled.desiredFingerprint} expected=${expectedDesiredFingerprint}`,
      );
    }
    return {
      schemaVersion: 1,
      stage: 'proofmode-ruleset-stage1-apply',
      repository: REPOSITORY,
      rulesetId: RULESET_ID,
      mode,
      status: 'already-applied',
      mutated: false,
      observedFingerprint: compiled.observedFingerprint,
      desiredFingerprint: compiled.desiredFingerprint,
      verifiedFingerprint: compiled.observedFingerprint,
    };
  }

  if (compiled.status !== 'ready' || !compiled.mutation) {
    throw new Error(`Unexpected stage-1 compiler disposition: ${compiled.status}`);
  }
  if (compiled.observedFingerprint !== expectedObservedFingerprint) {
    throw new Error(
      `Live ruleset drifted before stage 1. observed=${compiled.observedFingerprint} expected=${expectedObservedFingerprint}`,
    );
  }
  if (compiled.desiredFingerprint !== expectedDesiredFingerprint) {
    throw new Error(
      `Compiled desired ruleset drifted. desired=${compiled.desiredFingerprint} expected=${expectedDesiredFingerprint}`,
    );
  }

  const baseReceipt = {
    schemaVersion: 1,
    stage: 'proofmode-ruleset-stage1-apply',
    repository: REPOSITORY,
    rulesetId: RULESET_ID,
    mode,
    observedFingerprint: compiled.observedFingerprint,
    desiredFingerprint: compiled.desiredFingerprint,
  };

  if (mode === 'check') {
    return {
      ...baseReceipt,
      status: 'ready',
      mutated: false,
      verifiedFingerprint: null,
    };
  }

  if (clean(env.PROOFMODE_RULESET_REPAIR_CONFIRMATION) !== REPAIR_CONFIRMATION) {
    throw new Error(`Repair requires PROOFMODE_RULESET_REPAIR_CONFIRMATION=${REPAIR_CONFIRMATION}.`);
  }

  await githubJson({
    fetchImpl,
    token,
    method: compiled.mutation.method,
    url: apiUrl,
    apiVersion: compiled.mutation.apiVersion,
    body: compiled.mutation.body,
  });

  const verifiedRuleset = await githubJson({ fetchImpl, token, url: apiUrl });
  const verified = compileProofModeRulesetStage1({ ruleset: verifiedRuleset, repository: REPOSITORY });

  if (verified.status !== 'already-compliant') {
    throw new Error(`Stage-1 readback is not compliant: ${JSON.stringify(verified.violations || verified.status)}`);
  }
  if (
    verified.observedFingerprint !== expectedDesiredFingerprint
    || verified.desiredFingerprint !== expectedDesiredFingerprint
  ) {
    throw new Error(
      `Stage-1 readback fingerprint mismatch. observed=${verified.observedFingerprint} desired=${verified.desiredFingerprint} expected=${expectedDesiredFingerprint}`,
    );
  }

  return {
    ...baseReceipt,
    status: 'verified-applied',
    mutated: true,
    verifiedFingerprint: verified.observedFingerprint,
  };
}

export async function runProofModeRulesetStage1Cli(env = process.env) {
  const outputPath = clean(env.PROOFMODE_RULESET_RECEIPT_PATH) || DEFAULT_OUTPUT_PATH;
  try {
    const receipt = await applyProofModeRulesetStage1({ env });
    const written = writeReceipt(outputPath, receipt);
    console.log(JSON.stringify({ ...receipt, receiptPath: written }, null, 2));
    return receipt;
  } catch (error) {
    const failure = {
      schemaVersion: 1,
      stage: 'proofmode-ruleset-stage1-apply',
      repository: REPOSITORY,
      rulesetId: RULESET_ID,
      mode: clean(env.PROOFMODE_RULESET_MODE || 'check').toLowerCase(),
      status: 'blocked',
      mutated: false,
      error: error instanceof Error ? error.message : String(error),
    };
    const written = writeReceipt(outputPath, failure);
    console.error(JSON.stringify({ ...failure, receiptPath: written }, null, 2));
    throw error;
  }
}

export const PROOFMODE_RULESET_STAGE1 = Object.freeze({
  repository: REPOSITORY,
  rulesetId: RULESET_ID,
  expectedObservedFingerprint: DEFAULT_EXPECTED_OBSERVED_FINGERPRINT,
  expectedDesiredFingerprint: DEFAULT_EXPECTED_DESIRED_FINGERPRINT,
  repairConfirmation: REPAIR_CONFIRMATION,
});

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  runProofModeRulesetStage1Cli().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exit(1);
  });
}
