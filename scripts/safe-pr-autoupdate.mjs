import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

const LABEL = 'juss-auto-update';
const OWNER = 'jussray';
const MAX_SCANNED = 200;
const MAX_UPDATES = 5;

export function decision(pr, repoName) {
  if (!pr || pr.state !== 'open') return 'NOT_OPEN';
  if (pr.base?.ref !== 'main') return 'NON_MAIN_BASE';
  if (pr.head?.repo?.full_name?.toLowerCase() !== repoName.toLowerCase()) return 'EXTERNAL_HEAD';
  if (pr.user?.login?.toLowerCase() !== OWNER) return 'NON_FOUNDER_AUTHOR';
  if (!pr.labels?.some((label) => label.name === LABEL)) return 'NOT_OPTED_IN';
  if (pr.auto_merge) return 'AUTO_MERGE_ARMED_REAPPROVAL_REQUIRED';
  if (!/^[0-9a-f]{40}$/.test(pr.head?.sha || '')) return 'INVALID_HEAD';
  return 'CHECK_ANCESTRY';
}

function number(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function api(repo, path, method = 'GET', body = undefined) {
  const response = await fetch('https://api.github.com/repos/' + repo + path, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + process.env.GH_TOKEN,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'juss-safe-pr-refresh-v1',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    redirect: 'error',
    signal: AbortSignal.timeout(18000),
  });
  const raw = await response.text();
  const data = raw && response.ok ? JSON.parse(raw) : {};
  if (!response.ok) {
    throw new Error('GitHub API ' + method + ' ' + path.split('?')[0] + ' HTTP ' + response.status);
  }
  return { data, status: response.status };
}

function log(message) {
  // Internal run summary receives bounded metadata, not dynamic console logs.
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, message + '\n');
}

async function armMerge(repo) {
  const event = process.env.GITHUB_EVENT_NAME;
  const actor = (process.env.GITHUB_ACTOR || '').toLowerCase();
  if (event !== 'workflow_dispatch' || actor !== OWNER) {
    throw new Error('Only founder manual workflow dispatch can arm auto-merge.');
  }
  if (process.env.APPROVAL_PHRASE !== 'ARM_EXACT_AUTO_MERGE') {
    throw new Error('Exact founder approval phrase is missing.');
  }
  const n = number(process.env.PR_NUMBER);
  const head = process.env.EXPECTED_HEAD_SHA || '';
  const base = process.env.EXPECTED_BASE_SHA || '';
  if (!n || !/^[a-f0-9]{40}$/.test(head) || !/^[a-f0-9]{40}$/.test(base)) {
    throw new Error('Exact PR number, head SHA and base SHA required.');
  }
  const { data: pr } = await api(repo, '/pulls/' + n);
  if (decision(pr, repo) !== 'CHECK_ANCESTRY') throw new Error('PR is not eligible for founder auto-merge arming.');
  if (pr.draft || pr.head.sha !== head || pr.base.sha !== base || pr.mergeable === false) {
    throw new Error('PR draft, conflicted, or changed since exact approval.');
  }
  const { data: ancestry } = await api(repo, '/compare/' + head + '...' + base);
  if (ancestry.ahead_by !== 0) throw new Error('Head is behind current base. Refresh first; prior approval does not carry forward.');
  // This workflow itself is a founder's explicit, SHA-bound approval request.
  // GitHub still enforces branch protection, mandatory reviews and checks.
  const args = ['pr', 'merge', String(n), '--repo', repo, '--auto', '--merge', '--match-head-commit', head];
  const ran = spawnSync('gh', args, {
    env: { ...process.env, GH_TOKEN: process.env.GH_TOKEN },
    encoding: 'utf8',
    timeout: 45000,
  });
  if (ran.error || ran.status !== 0) throw new Error('Native auto-merge arm failed; inspect repository rules and PR state.');
  log('ARMED_OR_MERGED PR #' + n + ' approved exact head ' + head + ' against base ' + base);
}

async function refresh(repo) {
  const n = number(process.env.PR_NUMBER);
  const prs = [];
  if (n) {
    prs.push((await api(repo, '/pulls/' + n)).data);
  } else {
    for (let page = 1; page <= 2; page++) {
      const { data } = await api(repo, '/pulls?state=open&base=main&per_page=100&page=' + page);
      if (!Array.isArray(data)) throw new Error('Unexpected PR list response');
      prs.push(...data);
      if (data.length < 100) break;
    }
  }
  if (prs.length > MAX_SCANNED) throw new Error('PR list exceeded bounded scan budget');
  let requested = 0;
  let blockers = 0;
  for (const pr of prs) {
    const status = decision(pr, repo);
    if (status !== 'CHECK_ANCESTRY') {
      if (status === 'AUTO_MERGE_ARMED_REAPPROVAL_REQUIRED') {
        log('HOLD PR #' + pr.number + ': auto-merge armed; do not alter approved SHA.');
      }
      continue;
    }
    const { data: fresh } = await api(repo, '/pulls/' + pr.number);
    if (decision(fresh, repo) !== 'CHECK_ANCESTRY' || fresh.head.sha !== pr.head.sha) {
      log('STALE PR #' + pr.number + ': changed during inspection; skipped.');
      continue;
    }
    const { data: compare } = await api(repo, '/compare/' + fresh.head.sha + '...' + fresh.base.sha);
    if (compare.ahead_by === 0) {
      log('CURRENT PR #' + pr.number + ' head=' + fresh.head.sha);
      continue;
    }
    if (requested >= MAX_UPDATES) {
      log('BUDGET PR #' + pr.number + ': refresh deferred to next run.');
      continue;
    }
    // expected_head_sha is a compare-and-set guard. No force pushes or file rewrites.
    try {
      await api(repo, '/pulls/' + pr.number + '/update-branch', 'PUT', { expected_head_sha: fresh.head.sha });
      log('REFRESH_REQUESTED PR #' + pr.number + ' former_head=' + fresh.head.sha + ' base=' + fresh.base.sha);
      log('WARNING: CI/review evidence for the former head is now STALE; inspect the successor SHA.');
      requested++;
    } catch (error) {
      log('BLOCKED PR #' + pr.number + ': ' + error.message + '; use existing Reds Implant / Agent Merge for actual conflict repair.');
      blockers++;
    }
  }
  if (blockers) throw new Error(String(blockers) + ' opted-in PR branch refreshes failed.');
  log('SUMMARY scanned=' + prs.length + ' refresh_requested=' + requested + ' executed_skill_invocations=0 mergers=0');
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY || '';
  if (!/^jussray\/(promptos|chief-ai-machine)$/i.test(repo)) {
    throw new Error('Repository is outside the explicit trusted owner allowlist.');
  }
  if (!process.env.GH_TOKEN) throw new Error('A GitHub Actions token is required.');
  const action = process.env.AUTOBRANCH_ACTION || 'refresh';
  if (action === 'refresh') return refresh(repo);
  if (action === 'arm') return armMerge(repo);
  throw new Error('Unsupported action.');
}

if (process.argv.includes('--run')) {
  main().catch((error) => {
    log('BLOCKED: ' + error.message);
    console.error('SAFE_PR_AUTOMATION_BLOCKED');
    process.exitCode = 1;
  });
}
