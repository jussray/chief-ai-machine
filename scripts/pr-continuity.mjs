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
  if (!expected || expected !== actual) throw new Error(`HEAD_MOVED: expected ${expected || '<missing>'}, live ${actual || '<missing>'}`);
  return true;
}
export function replaceManagedBlock(body = '', block) {
  const starts = body.split(START_MARKER).length - 1;
  const ends = body.split(END_MARKER).length - 1;
  if (!starts && !ends) return `${body.trimEnd()}${body.trimEnd() ? '\n\n' : ''}${block}\n`;
  if (starts !== 1 || ends !== 1) throw new Error('MALFORMED_CONTINUITY_MARKERS');
  const start = body.indexOf(START_MARKER);
  const end = body.indexOf(END_MARKER);
  if (start > end) throw new Error('MALFORMED_CONTINUITY_MARKERS');
  const before = body.slice(0, start).trimEnd();
  const after = body.slice(end + END_MARKER.length).trimStart();
  return `${before}${before ? '\n\n' : ''}${block}${after ? `\n\n${after}` : '\n'}`;
}
export function continuityBlock(v) {
  return [
    START_MARKER,
    '## PR Continuity Receipt', '',
    `- schema: \`${SCHEMA}\``,
    `- repository: \`${v.repository}\``,
    `- pull_request: \`#${v.prNumber}\``,
    `- root_base: \`${v.rootBaseRef}@${v.rootBaseSha}\``,
    `- live_base: \`${v.baseRef}@${v.baseSha}\``,
    `- live_head: \`${v.headRef}@${v.headSha}\``,
    `- proof_subject: \`${v.headSha}\``,
    `- continuity: **${v.continuityState}**`,
    `- proof: **${v.proofState}**`,
    '- merge_authority: **false**',
    '- deploy_authority: **false**', '',
    '> Base/head movement expires predecessor exact-head CI, review, runtime, and browser proof. A successful rollover preserves history but does not donate green proof to the successor head.',
    END_MARKER,
  ].join('\n');
}
export function collectRolloverOrder(pulls, rootRef = 'main') {
  const queue = [rootRef], visitedRefs = new Set(), seenPulls = new Set(), order = [];
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
export const sameRepositoryPull = (pr, repository) => pr?.head?.repo?.full_name === repository && pr?.base?.repo?.full_name === repository;

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
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { message: text }; }
  if (!response.ok && !allow.includes(response.status)) throw new Error(`GITHUB_API_${response.status}: ${payload?.message || pathname}`);
  return { status: response.status, payload };
}
const getPull = async (repo, n) => (await github(`/repos/${repo}/pulls/${n}`)).payload;
const branchSha = async (repo, ref) => (await github(`/repos/${repo}/branches/${encodeURIComponent(ref)}`)).payload.commit.sha;
const compare = async (repo, base, head) => (await github(`/repos/${repo}/compare/${base}...${head}`)).payload.status;
async function listOpenPulls(repo) {
  const all = [];
  for (let page = 1; page <= 10; page += 1) {
    const rows = (await github(`/repos/${repo}/pulls?state=open&per_page=100&page=${page}`)).payload;
    all.push(...rows);
    if (rows.length < 100) return all;
  }
  throw new Error('PULL_PAGINATION_LIMIT_EXCEEDED');
}
async function patchBody(repo, pr, block) {
  let next;
  try { next = replaceManagedBlock(pr.body || '', block); }
  catch (error) { return { updated: false, blocked: true, reason: error.message }; }
  if (next === (pr.body || '')) return { updated: false, blocked: false };
  await github(`/repos/${repo}/pulls/${pr.number}`, { method: 'PATCH', body: { body: next } });
  return { updated: true, blocked: false };
}
function blockFor(repo, pr, rootBaseRef, rootBaseSha, continuityState, proofState) {
  return continuityBlock({
    repository: repo, prNumber: pr.number, rootBaseRef, rootBaseSha,
    baseRef: pr.base.ref, baseSha: pr.base.sha, headRef: pr.head.ref, headSha: pr.head.sha,
    continuityState, proofState,
  });
}
async function updateOnePull(repo, number, rootBaseRef) {
  let pr = await getPull(repo, number);
  const rootBaseSha = await branchSha(repo, rootBaseRef);
  if (!sameRepositoryPull(pr, repo)) {
    const metadata = await patchBody(repo, pr, blockFor(repo, pr, rootBaseRef, rootBaseSha, 'BLOCKED_FORK', 'BLOCKED'));
    return { number, state: 'BLOCKED_FORK', headRef: pr.head.ref, metadata };
  }
  let status = await compare(repo, pr.base.sha, pr.head.sha);
  if (isCurrentCompareStatus(status)) {
    const metadata = await patchBody(repo, pr, blockFor(repo, pr, rootBaseRef, rootBaseSha, 'CURRENT', 'EXACT_HEAD_PROOF_SEPARATE'));
    return { number, state: metadata.blocked ? 'BLOCKED_METADATA' : 'CURRENT', headRef: pr.head.ref, headSha: pr.head.sha, metadata };
  }

  const before = pr.head.sha;
  const update = await github(`/repos/${repo}/pulls/${number}/update-branch`, { method: 'PUT', body: { expected_head_sha: before }, allow: [202, 422] });
  if (update.status === 422) {
    pr = await getPull(repo, number);
    status = sameRepositoryPull(pr, repo) ? await compare(repo, pr.base.sha, pr.head.sha) : 'fork';
    if (isCurrentCompareStatus(status)) return updateOnePull(repo, number, rootBaseRef);
    const metadata = await patchBody(repo, pr, blockFor(repo, pr, rootBaseRef, rootBaseSha, 'BLOCKED_CONFLICT_OR_RACE', 'BLOCKED'));
    return { number, state: 'BLOCKED_CONFLICT_OR_RACE', headRef: pr.head.ref, headSha: pr.head.sha, metadata, providerMessage: update.payload?.message || null };
  }

  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    pr = await getPull(repo, number);
    status = await compare(repo, pr.base.sha, pr.head.sha);
    if (pr.head.sha !== before && isCurrentCompareStatus(status)) break;
  }
  status = await compare(repo, pr.base.sha, pr.head.sha);
  let state = isCurrentCompareStatus(status) ? (pr.head.sha !== before ? 'ROLLED_FORWARD' : 'CURRENT_AFTER_RACE') : 'BLOCKED_UPDATE_TIMEOUT';
  const proofState = state === 'ROLLED_FORWARD' ? 'REVERIFY_REQUIRED' : (state === 'CURRENT_AFTER_RACE' ? 'EXACT_HEAD_PROOF_SEPARATE' : 'BLOCKED');
  const metadata = await patchBody(repo, pr, blockFor(repo, pr, rootBaseRef, rootBaseSha, state, proofState));
  if (metadata.blocked) state = 'BLOCKED_METADATA';
  return { number, state, headRef: pr.head.ref, headBefore: before, headSha: pr.head.sha, metadata };
}

export async function auditMode() {
  const repo = env('GITHUB_REPOSITORY'), prNumber = Number(env('PR_NUMBER')), expectedHead = env('EXPECTED_HEAD_SHA'), rootBaseRef = env('ROOT_BASE_REF', 'main');
  if (!repo || !prNumber) throw new Error('AUDIT_INPUT_REQUIRED');
  const pr = await getPull(repo, prNumber);
  assertExpectedHead(expectedHead, pr.head.sha);
  if (!sameRepositoryPull(pr, repo)) {
    writeReceipt({ schema: SCHEMA, mode: 'audit', repository: repo, prNumber, state: 'BLOCKED_FORK', authorizesMerge: false, authorizesDeploy: false });
    throw new Error('BLOCKED_FORK');
  }
  const status = await compare(repo, pr.base.sha, pr.head.sha), state = classifyCompareStatus(status);
  const receipt = {
    schema: SCHEMA, mode: 'audit', repository: repo, prNumber,
    rootBaseRef, rootBaseSha: await branchSha(repo, rootBaseRef),
    baseRef: pr.base.ref, baseSha: pr.base.sha, headRef: pr.head.ref, headSha: pr.head.sha,
    compareStatus: status, state, proofSubjectSha: pr.head.sha,
    predecessorProofExpiresOnHeadMove: true, authorizesMerge: false, authorizesDeploy: false,
  };
  writeReceipt(receipt);
  if (state !== 'CURRENT') throw new Error(`${state}: ${pr.base.sha} is not an ancestor of ${pr.head.sha}`);
  console.log(JSON.stringify(receipt));
}

export async function metadataMode() {
  const repo = env('GITHUB_REPOSITORY'), prNumber = Number(env('PR_NUMBER')), rootBaseRef = env('ROOT_BASE_REF', 'main');
  if (!repo || !prNumber) throw new Error('METADATA_INPUT_REQUIRED');
  const pr = await getPull(repo, prNumber), rootBaseSha = await branchSha(repo, rootBaseRef);
  const state = sameRepositoryPull(pr, repo) ? classifyCompareStatus(await compare(repo, pr.base.sha, pr.head.sha)) : 'BLOCKED_FORK';
  const metadata = await patchBody(repo, pr, blockFor(repo, pr, rootBaseRef, rootBaseSha, state, state === 'CURRENT' ? 'EXACT_HEAD_PROOF_SEPARATE' : 'REVERIFY_OR_ROLLOVER_REQUIRED'));
  const receipt = { schema: SCHEMA, mode: 'metadata', repository: repo, prNumber, state, metadata, authorizesMerge: false, authorizesDeploy: false };
  writeReceipt(receipt);
  if (metadata.blocked) throw new Error(`METADATA_BLOCKED: ${metadata.reason}`);
  console.log(JSON.stringify(receipt));
}

export async function rolloverMode() {
  const repo = env('GITHUB_REPOSITORY'), rootBaseRef = env('ROOT_BASE_REF', 'main');
  if (!repo) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  const order = collectRolloverOrder(await listOpenPulls(repo), rootBaseRef), results = [];
  for (const number of order) results.push(await updateOnePull(repo, number, rootBaseRef));
  const blocked = results.filter((r) => r.state.startsWith('BLOCKED'));
  const receipt = {
    schema: SCHEMA, mode: 'rollover', repository: repo, rootBaseRef,
    rootBaseSha: await branchSha(repo, rootBaseRef), order, results, blockedCount: blocked.length,
    predecessorProofExpiresOnHeadMove: true, authorizesMerge: false, authorizesDeploy: false,
  };
  writeReceipt(receipt);
  console.log(JSON.stringify(receipt));
  if (blocked.length) throw new Error(`ROLLOVER_BLOCKED: ${blocked.map((r) => `#${r.number}:${r.state}`).join(',')}`);
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'audit') return auditMode();
  if (mode === 'metadata') return metadataMode();
  if (mode === 'rollover') return rolloverMode();
  throw new Error('Usage: node scripts/pr-continuity.mjs <audit|metadata|rollover>');
}
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
