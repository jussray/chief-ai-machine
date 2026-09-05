import fs from 'node:fs';
import path from 'node:path';

export const START_MARKER = '<!-- pr-continuity:start -->';
export const END_MARKER = '<!-- pr-continuity:end -->';
export const SCHEMA = 'juss/pr-continuity@v1';

export const isCurrentCompareStatus = (status) => status === 'ahead' || status === 'identical';

export function classifyCompareStatus(status) {
  if (isCurrentCompareStatus(status)) return 'CURRENT';
  if (status === 'behind' || status === 'diverged') return 'STALE_BASE';
  return 'BLOCKED_UNKNOWN_COMPARE';
}

export function assertExpectedHead(expected, actual) {
  if (!expected || expected !== actual) {
    throw new Error(`HEAD_MOVED: expected ${expected || '<missing>'}, live ${actual || '<missing>'}`);
  }
  return true;
}

export function replaceManagedBlock(body = '', block) {
  const starts = body.split(START_MARKER).length - 1;
  const ends = body.split(END_MARKER).length - 1;
  if (!starts && !ends) {
    return `${body.trimEnd()}${body.trimEnd() ? '\n\n' : ''}${block}\n`;
  }
  if (starts !== 1 || ends !== 1) throw new Error('MALFORMED_CONTINUITY_MARKERS');
  const start = body.indexOf(START_MARKER);
  const end = body.indexOf(END_MARKER);
  if (start > end) throw new Error('MALFORMED_CONTINUITY_MARKERS');
  const before = body.slice(0, start).trimEnd();
  const after = body.slice(end + END_MARKER.length).trimStart();
  return `${before}${before ? '\n\n' : ''}${block}${after ? `\n\n${after}` : '\n'}`;
}

export function continuityBlock(value) {
  return [
    START_MARKER,
    '## PR Continuity Receipt',
    '',
    `- schema: \`${SCHEMA}\``,
    `- repository: \`${value.repository}\``,
    `- pull_request: \`#${value.prNumber}\``,
    `- root_base: \`${value.rootBaseRef}@${value.rootBaseSha}\``,
    `- live_base: \`${value.baseRef}@${value.baseSha}\``,
    `- live_head: \`${value.headRef}@${value.headSha}\``,
    `- proof_subject: \`${value.headSha}\``,
    `- continuity: **${value.continuityState}**`,
    `- proof: **${value.proofState}**`,
    '- merge_authority: **false**',
    '- deploy_authority: **false**',
    '',
    '> Base/head movement expires predecessor exact-head CI, review, runtime, and browser proof. A successful rollover preserves history but does not donate green proof to the successor head.',
    END_MARKER,
  ].join('\n');
}

export function collectRolloverOrder(pulls, rootRef = 'main') {
  const queue = [rootRef];
  const visitedRefs = new Set();
  const seenPulls = new Set();
  const order = [];
  while (queue.length) {
    const baseRef = queue.shift();
    if (visitedRefs.has(baseRef)) continue;
    visitedRefs.add(baseRef);
    for (const pr of pulls) {
      if (pr.state !== 'open' || pr.base?.ref !== baseRef || seenPulls.has(pr.number)) continue;
      seenPulls.add(pr.number);
      order.push(pr.number);
      if (pr.head?.ref) queue.push(pr.head.ref);
    }
  }
  return order;
}

export const sameRepositoryPull = (pr, repository) =>
  pr?.head?.repo?.full_name === repository && pr?.base?.repo?.full_name === repository;

const env = (name, fallback = '') => process.env[name] || fallback;
const artifactPath = () => env('ARTIFACT_PATH', 'artifacts/pr-continuity.json');

function writeReceipt(value) {
  const target = path.resolve(artifactPath());
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

async function github(pathname, { method = 'GET', body, allow = [] } = {}) {
  const token = env('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN_REQUIRED');
  const response = await fetch(`https://api.github.com${pathname}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'juss-pr-continuity-v1',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }
  if (!response.ok && !allow.includes(response.status)) {
    throw new Error(`GITHUB_API_${response.status}: ${payload?.message || pathname}`);
  }
  return { status: response.status, payload };
}

const getPull = async (repository, number) =>
  (await github(`/repos/${repository}/pulls/${number}`)).payload;
const branchSha = async (repository, ref) =>
  (await github(`/repos/${repository}/branches/${encodeURIComponent(ref)}`)).payload.commit.sha;
const compare = async (repository, base, head) =>
  (await github(`/repos/${repository}/compare/${base}...${head}`)).payload.status;

async function listOpenPulls(repository) {
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const rows = (await github(`/repos/${repository}/pulls?state=open&per_page=100&page=${page}`)).payload;
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  throw new Error('PULL_PAGINATION_LIMIT_EXCEEDED');
}

async function patchBody(repository, pr, block) {
  let next;
  try {
    next = replaceManagedBlock(pr.body || '', block);
  } catch (error) {
    return { updated: false, blocked: true, reason: error.message };
  }
  if (next === (pr.body || '')) return { updated: false, blocked: false };
  await github(`/repos/${repository}/pulls/${pr.number}`, { method: 'PATCH', body: { body: next } });
  return { updated: true, blocked: false };
}

const blockFor = (repository, pr, rootRef, rootSha, state, proof) =>
  continuityBlock({
    repository,
    prNumber: pr.number,
    rootBaseRef: rootRef,
    rootBaseSha: rootSha,
    baseRef: pr.base.ref,
    baseSha: pr.base.sha,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    continuityState: state,
    proofState: proof,
  });

async function updateOnePull(repository, number, rootRef) {
  let pr = await getPull(repository, number);
  const rootSha = await branchSha(repository, rootRef);
  if (!sameRepositoryPull(pr, repository)) {
    const metadata = await patchBody(repository, pr, blockFor(repository, pr, rootRef, rootSha, 'BLOCKED_FORK', 'BLOCKED'));
    return { number, state: 'BLOCKED_FORK', headRef: pr.head.ref, metadata };
  }

  let status = await compare(repository, pr.base.sha, pr.head.sha);
  if (isCurrentCompareStatus(status)) {
    const metadata = await patchBody(repository, pr, blockFor(repository, pr, rootRef, rootSha, 'CURRENT', 'EXACT_HEAD_PROOF_SEPARATE'));
    return {
      number,
      state: metadata.blocked ? 'BLOCKED_METADATA' : 'CURRENT',
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      metadata,
    };
  }

  const before = pr.head.sha;
  const update = await github(`/repos/${repository}/pulls/${number}/update-branch`, {
    method: 'PUT',
    body: { expected_head_sha: before },
    allow: [202, 422],
  });

  if (update.status === 422) {
    pr = await getPull(repository, number);
    status = sameRepositoryPull(pr, repository) ? await compare(repository, pr.base.sha, pr.head.sha) : 'fork';
    if (isCurrentCompareStatus(status)) return updateOnePull(repository, number, rootRef);
    const metadata = await patchBody(repository, pr, blockFor(repository, pr, rootRef, rootSha, 'BLOCKED_CONFLICT_OR_RACE', 'BLOCKED'));
    return {
      number,
      state: 'BLOCKED_CONFLICT_OR_RACE',
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      metadata,
      providerMessage: update.payload?.message || null,
    };
  }

  for (let index = 0; index < 15; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    pr = await getPull(repository, number);
    status = await compare(repository, pr.base.sha, pr.head.sha);
    if (pr.head.sha !== before && isCurrentCompareStatus(status)) break;
  }

  status = await compare(repository, pr.base.sha, pr.head.sha);
  let state = isCurrentCompareStatus(status)
    ? (pr.head.sha !== before ? 'ROLLED_FORWARD' : 'CURRENT_AFTER_RACE')
    : 'BLOCKED_UPDATE_TIMEOUT';
  const proof = state === 'ROLLED_FORWARD'
    ? 'REVERIFY_REQUIRED'
    : state === 'CURRENT_AFTER_RACE'
      ? 'EXACT_HEAD_PROOF_SEPARATE'
      : 'BLOCKED';
  const metadata = await patchBody(repository, pr, blockFor(repository, pr, rootRef, rootSha, state, proof));
  if (metadata.blocked) state = 'BLOCKED_METADATA';
  return { number, state, headRef: pr.head.ref, headBefore: before, headSha: pr.head.sha, metadata };
}

export async function auditMode() {
  const repository = env('GITHUB_REPOSITORY');
  const number = Number(env('PR_NUMBER'));
  const expected = env('EXPECTED_HEAD_SHA');
  const rootRef = env('ROOT_BASE_REF', 'main');
  if (!repository || !number) throw new Error('AUDIT_INPUT_REQUIRED');

  const pr = await getPull(repository, number);
  assertExpectedHead(expected, pr.head.sha);
  if (!sameRepositoryPull(pr, repository)) {
    writeReceipt({ schema: SCHEMA, mode: 'audit', repository, prNumber: number, state: 'BLOCKED_FORK', authorizesMerge: false, authorizesDeploy: false });
    throw new Error('BLOCKED_FORK');
  }

  const status = await compare(repository, pr.base.sha, pr.head.sha);
  const state = classifyCompareStatus(status);
  const receipt = {
    schema: SCHEMA,
    mode: 'audit',
    repository,
    prNumber: number,
    rootBaseRef: rootRef,
    rootBaseSha: await branchSha(repository, rootRef),
    baseRef: pr.base.ref,
    baseSha: pr.base.sha,
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    compareStatus: status,
    state,
    proofSubjectSha: pr.head.sha,
    predecessorProofExpiresOnHeadMove: true,
    authorizesMerge: false,
    authorizesDeploy: false,
  };
  writeReceipt(receipt);
  if (state !== 'CURRENT') throw new Error(`${state}: ${pr.base.sha} is not an ancestor of ${pr.head.sha}`);
  console.log(JSON.stringify(receipt));
}

export async function metadataMode() {
  const repository = env('GITHUB_REPOSITORY');
  const number = Number(env('PR_NUMBER'));
  const rootRef = env('ROOT_BASE_REF', 'main');
  if (!repository || !number) throw new Error('METADATA_INPUT_REQUIRED');

  const pr = await getPull(repository, number);
  const rootSha = await branchSha(repository, rootRef);
  const state = sameRepositoryPull(pr, repository)
    ? classifyCompareStatus(await compare(repository, pr.base.sha, pr.head.sha))
    : 'BLOCKED_FORK';
  const metadata = await patchBody(
    repository,
    pr,
    blockFor(repository, pr, rootRef, rootSha, state, state === 'CURRENT' ? 'EXACT_HEAD_PROOF_SEPARATE' : 'REVERIFY_OR_ROLLOVER_REQUIRED'),
  );
  const receipt = { schema: SCHEMA, mode: 'metadata', repository, prNumber: number, state, metadata, authorizesMerge: false, authorizesDeploy: false };
  writeReceipt(receipt);
  if (metadata.blocked) throw new Error(`METADATA_BLOCKED: ${metadata.reason}`);
  console.log(JSON.stringify(receipt));
}

export async function rolloverMode() {
  const repository = env('GITHUB_REPOSITORY');
  const rootRef = env('ROOT_BASE_REF', 'main');
  if (!repository) throw new Error('GITHUB_REPOSITORY_REQUIRED');

  const order = collectRolloverOrder(await listOpenPulls(repository), rootRef);
  const results = [];
  for (const number of order) results.push(await updateOnePull(repository, number, rootRef));
  const blocked = results.filter((item) => item.state.startsWith('BLOCKED'));
  const receipt = {
    schema: SCHEMA,
    mode: 'rollover',
    repository,
    rootBaseRef: rootRef,
    rootBaseSha: await branchSha(repository, rootRef),
    order,
    results,
    blockedCount: blocked.length,
    predecessorProofExpiresOnHeadMove: true,
    authorizesMerge: false,
    authorizesDeploy: false,
  };
  writeReceipt(receipt);
  console.log(JSON.stringify(receipt));
  if (blocked.length) {
    throw new Error(`ROLLOVER_BLOCKED: ${blocked.map((item) => `#${item.number}:${item.state}`).join(',')}`);
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'audit') return auditMode();
  if (mode === 'metadata') return metadataMode();
  if (mode === 'rollover') return rolloverMode();
  throw new Error('Usage: node scripts/pr-continuity.mjs <audit|metadata|rollover>');
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}
