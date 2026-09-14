import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PR_CURRENT_TRUTH_CONTRACT = 'chief/pr-current-truth@v1';
export const CURRENT_TRUTH_START = '<!-- chief-current-truth:start -->';
export const CURRENT_TRUTH_END = '<!-- chief-current-truth:end -->';

const FULL_SHA = /^[0-9a-f]{40}$/i;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;

const clean = (value) => (typeof value === 'string' ? value.trim() : '');
const normalizeSha = (value) => clean(value).toLowerCase();

function occurrences(value, needle) {
  if (!needle) return 0;
  let count = 0;
  let offset = 0;
  while (true) {
    const index = value.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + needle.length;
  }
}

function parseDeclaredBlock(body) {
  const raw = typeof body === 'string' ? body : '';
  const startCount = occurrences(raw, CURRENT_TRUTH_START);
  const endCount = occurrences(raw, CURRENT_TRUTH_END);

  if (startCount === 0 && endCount === 0) {
    return { state: 'absent', block: null, reasons: [] };
  }

  if (startCount !== 1 || endCount !== 1) {
    return {
      state: 'invalid',
      block: null,
      reasons: ['current_truth_markers_must_be_unique'],
    };
  }

  const start = raw.indexOf(CURRENT_TRUTH_START);
  const end = raw.indexOf(CURRENT_TRUTH_END);
  if (start < 0 || end < start) {
    return {
      state: 'invalid',
      block: null,
      reasons: ['current_truth_marker_order_invalid'],
    };
  }

  const block = raw.slice(start + CURRENT_TRUTH_START.length, end);
  const repository = block.match(/^\s*-\s*repository:\s*`([^`]+)`\s*$/m)?.[1] ?? '';
  const pullRequest = block.match(/^\s*-\s*pull_request:\s*`#(\d+)`\s*$/m)?.[1] ?? '';
  const liveHead = block.match(/^\s*-\s*live_head:\s*`([^`@]+)@([0-9a-fA-F]{40})`\s*$/m);

  const reasons = [];
  if (!REPOSITORY.test(clean(repository))) reasons.push('declared_repository_missing_or_invalid');
  if (!/^\d+$/.test(clean(pullRequest)) || Number(pullRequest) <= 0) reasons.push('declared_pull_request_missing_or_invalid');
  if (!liveHead) reasons.push('declared_live_head_missing_or_invalid');

  return {
    state: reasons.length ? 'invalid' : 'parsed',
    block,
    reasons,
    declared: {
      repository: clean(repository).toLowerCase(),
      prNumber: pullRequest ? Number(pullRequest) : null,
      headRef: clean(liveHead?.[1]),
      headSha: normalizeSha(liveHead?.[2]),
    },
  };
}

export function evaluatePrCurrentTruth({
  body = '',
  repository = '',
  prNumber = null,
  headRef = '',
  headSha = '',
} = {}) {
  const observed = {
    repository: clean(repository).toLowerCase(),
    prNumber: Number.isInteger(prNumber) ? prNumber : Number(prNumber) || null,
    headRef: clean(headRef),
    headSha: normalizeSha(headSha),
  };

  const parsed = parseDeclaredBlock(body);
  if (parsed.state === 'absent') {
    return {
      contract: PR_CURRENT_TRUTH_CONTRACT,
      classification: 'ABSENT',
      reasons: [],
      declaredSnapshot: null,
      observed,
      prBodyAuthoritative: false,
      machineCurrentTruthAuthority: 'github-pr-metadata+exact-head-ledger',
      historicalTruthPreserved: true,
      currentTruthReobserved: true,
      reacquireRequired: false,
      mergeAuthority: false,
    };
  }

  const reasons = [...parsed.reasons];
  if (!REPOSITORY.test(observed.repository)) reasons.push('observed_repository_missing_or_invalid');
  if (!Number.isInteger(observed.prNumber) || observed.prNumber <= 0) reasons.push('observed_pull_request_missing_or_invalid');
  if (!observed.headRef) reasons.push('observed_head_ref_missing');
  if (!FULL_SHA.test(observed.headSha)) reasons.push('observed_head_sha_missing_or_invalid');

  if (parsed.state === 'parsed' && reasons.length === 0) {
    if (parsed.declared.repository !== observed.repository) reasons.push('repository_moved');
    if (parsed.declared.prNumber !== observed.prNumber) reasons.push('pull_request_moved');
    if (parsed.declared.headRef !== observed.headRef) reasons.push('head_ref_moved');
    if (parsed.declared.headSha !== observed.headSha) reasons.push('head_sha_moved');
  }

  const structuralInvalid = parsed.state === 'invalid'
    || reasons.some((reason) => reason.includes('missing_or_invalid') || reason === 'observed_head_ref_missing');
  const classification = structuralInvalid ? 'INVALID' : reasons.length ? 'STALE' : 'CURRENT';

  return {
    contract: PR_CURRENT_TRUTH_CONTRACT,
    classification,
    reasons: [...new Set(reasons)].sort((a, b) => a.localeCompare(b)),
    declaredSnapshot: parsed.declared ?? null,
    observed,
    prBodyAuthoritative: false,
    machineCurrentTruthAuthority: 'github-pr-metadata+exact-head-ledger',
    historicalTruthPreserved: true,
    currentTruthReobserved: true,
    reacquireRequired: classification === 'STALE' || classification === 'INVALID',
    mergeAuthority: false,
  };
}

export function writePrCurrentTruthReceipt({
  env = process.env,
  outputPath = clean(process.env.PR_CURRENT_TRUTH_PATH) || 'artifacts/pr-current-truth.json',
} = {}) {
  const body = typeof env.PR_BODY === 'string' ? env.PR_BODY : '';
  const receipt = evaluatePrCurrentTruth({
    body,
    repository: env.PR_REPOSITORY || env.GITHUB_REPOSITORY || '',
    prNumber: env.PR_NUMBER ? Number(env.PR_NUMBER) : null,
    headRef: env.PR_HEAD_REF || env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME || '',
    headSha: env.PR_HEAD_SHA || env.EXPECTED_HEAD_SHA || env.GITHUB_SHA || '',
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(receipt, null, 2));
  return receipt;
}

const isDirectExecution = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  const receipt = writePrCurrentTruthReceipt();
  const enforce = process.argv.includes('--enforce');
  if (enforce && (receipt.classification === 'STALE' || receipt.classification === 'INVALID')) {
    console.error(`PR current-truth receipt ${receipt.classification.toLowerCase()}: ${receipt.reasons.join(', ')}`);
    process.exit(1);
  }
}
