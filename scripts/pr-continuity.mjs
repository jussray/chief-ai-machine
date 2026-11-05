import fs from 'node:fs';
import path from 'node:path';

export const START_MARKER = '<!-- pr-continuity:start -->';
export const END_MARKER = '<!-- pr-continuity:end -->';
export const SCHEMA = 'juss/pr-continuity@v1';
export const CONTINUITY_GATE_NAME = 'PR Continuity Exact-Head Gate';

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

// Legacy formatter retained for reading/testing historical receipts. Automation no longer
// writes continuity markers into human-owned PR bodies.
export function replaceManagedBlock(body = '', block) {
  const starts = body.split(START_MARKER).length - 1;
  const ends = body.split(END_MARKER).length - 1;
  if (!starts && !ends) {
    if (!body) return `${block}\n`;
    return `${body}${body.endsWith('\n') ? '\n' : '\n\n'}${block}\n`;
  }
  if (starts !== 1 || ends !== 1) throw new Error('MALFORMED_CONTINUITY_MARKERS');
  const start = body.indexOf(START_MARKER);
  const end = body.indexOf(END_MARKER);
  if (start > end) throw new Error('MALFORMED_CONTINUITY_MARKERS');
  return `${body.slice(0, start)}${block}${body.slice(end + END_MARKER.length)}`;
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

export const sameRepositoryPull = (pr, repository) => pr?.head?.repo?.full_name === repository && pr?.base?.repo?.full_name === repository;
export function samePullSnapshot(expected, actual) {
  return Boolean(
    expected
    && actual
    && expected.number === actual.number
    && expected.head?.sha === actual.head?.sha
    && (expected.body || '') === (actual.body || ''),
  );
}
export function collectRolloverOrder(pulls, rootRef = 'main', repository = '') {
  const queue = [rootRef], visitedRefs = new Set(), seenPulls = new Set(), order = [];
  while (queue.length) {
    const baseRef = queue.shift();
    if (visitedRefs.has(baseRef)) continue;
    visitedRefs.add(baseRef);
    for (const pr of pulls) {
      if (pr.state !== 'open' || pr.base?.ref !== baseRef || seenPulls.has(pr.number)) continue;
      if (repository && !sameRepositoryPull(pr, repository)) continue;
      seenPulls.add(pr.number);
      order.push(pr.number);
      if (pr.head?.ref) queue.push(pr.head.ref);
    }
  }
  return order;
}

export function humanOwnedMetadata(state = 'READ_ONLY') {
  return Object.freeze({
    updated: false,
    blocked: false,
    humanOwnedPrBody: true,
    bodyMutation: false,
    destination: 'artifact-and-checks',
    state,
  });
}

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
async function waitForReverification(repo, sha) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const payload = (await github(`/repos/${repo}/commits/${sha}/check-runs?per_page=100`)).payload;
    const runs = payload?.check_runs || [];
    if (runs.some((run) => run.head_sha === sha && ['Typecheck', 'PR Continuity Candidate Observation'].includes(run.name))) return true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}
async function publishHeadFailure(repo, result) {
  if (!result?.headSha) return;
  const summary = `Continuity rollover blocked for PR #${result.number}: ${result.state}. Exact-head proof must be reacquired after the block is cleared.`;
  await github(`/repos/${repo}/check-runs`, {
    method: 'POST',
    body: {
      name: CONTINUITY_GATE_NAME,
      head_sha: result.headSha,
      status: 'completed',
      conclusion: 'failure',
      output: { title: 'PR continuity blocked', summary },
    },
  });
}
function providerUpdateBlockedResult(pr, providerMessage) {
  return {
    number: pr.number,
    state: 'BLOCKED_PROVIDER_UPDATE',
    headRef: pr.head.ref,
    headSha: pr.head.sha,
    metadata: humanOwnedMetadata('BLOCKED_PROVIDER_UPDATE'),
    providerMessage,
  };
}
function providerApiBlockedResult(pr, error) {
  return {
    number: pr.number,
    state: 'BLOCKED_PROVIDER_API',
    headRef: pr.head?.ref || null,
    headSha: pr.head?.sha || null,
    metadata: humanOwnedMetadata('BLOCKED_PROVIDER_API'),
    providerMessage: error?.message || String(error || 'unknown provider error'),
  };
}
async function updateOnePull(repo, number, rootBaseRef) {
  let pr = await getPull(repo, number);
  await branchSha(repo, rootBaseRef);
  if (!sameRepositoryPull(pr, repo)) {
    return { number, state: 'BLOCKED_FORK', headRef: pr.head.ref, headSha: pr.head.sha, metadata: humanOwnedMetadata('BLOCKED_FORK') };
  }
  let status = await compare(repo, pr.base.sha, pr.head.sha);
  if (isCurrentCompareStatus(status)) {
    return { number, state: 'CURRENT', headRef: pr.head.ref, headSha: pr.head.sha, metadata: humanOwnedMetadata('CURRENT') };
  }

  const before = pr.head.sha;
  let update;
  try {
    update = await github(`/repos/${repo}/pulls/${number}/update-branch`, {
      method: 'PUT',
      body: { expected_head_sha: before },
      allow: [202, 403, 409, 422, 500, 502, 503, 504],
    });
  } catch (error) {
    return providerUpdateBlockedResult(pr, error.message);
  }
  if (update.status !== 202 && update.status !== 422) {
    return providerUpdateBlockedResult(
      pr,
      `GITHUB_API_${update.status}: ${update.payload?.message || 'update-branch failed'}`,
    );
  }
  if (update.status === 422) {
    pr = await getPull(repo, number);
    status = sameRepositoryPull(pr, repo) ? await compare(repo, pr.base.sha, pr.head.sha) : 'fork';
    if (isCurrentCompareStatus(status)) return updateOnePull(repo, number, rootBaseRef);
    return {
      number,
      state: 'BLOCKED_CONFLICT_OR_RACE',
      headRef: pr.head.ref,
      headSha: pr.head.sha,
      metadata: humanOwnedMetadata('BLOCKED_CONFLICT_OR_RACE'),
      providerMessage: update.payload?.message || null,
    };
  }

  for (let attempt = 0; attempt < 15; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    pr = await getPull(repo, number);
    status = await compare(repo, pr.base.sha, pr.head.sha);
    if (pr.head.sha !== before && isCurrentCompareStatus(status)) break;
  }
  status = await compare(repo, pr.base.sha, pr.head.sha);
  let state = isCurrentCompareStatus(status) ? (pr.head.sha !== before ? 'ROLLED_FORWARD' : 'CURRENT_AFTER_RACE') : 'BLOCKED_UPDATE_TIMEOUT';
  let reverifyTriggered = null;
  if (state === 'ROLLED_FORWARD') {
    reverifyTriggered = await waitForReverification(repo, pr.head.sha);
    if (!reverifyTriggered) state = 'BLOCKED_REVERIFY_TRIGGER';
  }
  return {
    number,
    state,
    headRef: pr.head.ref,
    headBefore: before,
    headSha: pr.head.sha,
    reverifyTriggered,
    metadata: humanOwnedMetadata(state),
  };
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
  const receipt = {
    schema: SCHEMA,
    mode: 'metadata',
    repository: repo,
    prNumber,
    rootBaseRef,
    rootBaseSha,
    state,
    proofSubjectSha: pr.head?.sha || null,
    metadata: humanOwnedMetadata(state),
    authorizesMerge: false,
    authorizesDeploy: false,
  };
  writeReceipt(receipt);
  console.log(JSON.stringify(receipt));
}

export async function rolloverMode() {
  const repo = env('GITHUB_REPOSITORY'), rootBaseRef = env('ROOT_BASE_REF', 'main');
  if (!repo) throw new Error('GITHUB_REPOSITORY_REQUIRED');
  const rootBaseSha = await branchSha(repo, rootBaseRef);
  const pulls = await listOpenPulls(repo);
  const pullByNumber = new Map(pulls.map((pr) => [pr.number, pr]));
  const order = collectRolloverOrder(pulls, rootBaseRef, repo), results = [];
  for (const number of order) {
    try {
      results.push(await updateOnePull(repo, number, rootBaseRef));
    } catch (error) {
      results.push(providerApiBlockedResult(pullByNumber.get(number), error));
    }
  }
  const blocked = results.filter((r) => r.state.startsWith('BLOCKED'));
  const receipt = {
    schema: SCHEMA, mode: 'rollover', repository: repo, rootBaseRef,
    rootBaseSha, order, results, blockedCount: blocked.length,
    predecessorProofExpiresOnHeadMove: true, authorizesMerge: false, authorizesDeploy: false,
  };
  writeReceipt(receipt);
  console.log(JSON.stringify(receipt));
  if (blocked.length) {
    const publishErrors = [];
    for (const result of blocked) {
      try { await publishHeadFailure(repo, result); }
      catch (error) { publishErrors.push(`#${result.number}:${error.message}`); }
    }
    if (publishErrors.length) console.error(`HEAD_FAILURE_PUBLISH_ERRORS: ${publishErrors.join(',')}`);
    throw new Error(`ROLLOVER_BLOCKED: ${blocked.map((r) => `#${r.number}:${r.state}`).join(',')}`);
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'audit') return auditMode();
  if (mode === 'metadata') return metadataMode();
  if (mode === 'rollover') return rolloverMode();
  throw new Error('Usage: node scripts/pr-continuity.mjs <audit|metadata|rollover>');
}
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) main().catch((error) => { console.error(error.stack || error.message); process.exit(1); });