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
    signal: globalThis.AbortSignal.timeout(18000),
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
  // No deferred native auto-merge: --match-head-commit does not persist
  // a base/head approval lease after this command exits.
  const event = process.env.GITHUB_EVENT_NAME;
  const actor = (process.env.GITHUB_ACTOR || '').toLowerCase();
  if (event !== 'workflow_dispatch' || actor !== OWNER) {
    throw new Error('Only founder manual workflow dispatch can request a one-shot merge.');
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
  const mergeToken = process.env.MERGE_GH_TOKEN || '';
  if (!mergeToken || mergeToken === process.env.GH_TOKEN) {
    throw new Error('APP_IDENTITY_REQUIRED: a separately authorized GitHub App merge token is required to preserve post-merge workflows.');
  }

  // Enforce a provider-side strict up-to-date requirement to close the
  // unavoidable base-ref race between the final read and merge API call.
  const { data: list } = await api(repo, '/rulesets');
  if (!Array.isArray(list)) throw new Error('Effective GitHub rulesets could not be inspected.');
  let strict = false;
  for (const item of list) {
    if (item.enforcement !== 'active') continue;
    const { data: rule } = await api(repo, '/rulesets/' + item.id);
    const refs = rule.conditions?.ref_name;
    const include = refs?.include || [];
    const exclude = refs?.exclude || [];
    if (!include.some((x) => ['~ALL', '~DEFAULT_BRANCH', 'refs/heads/main'].includes(x))
      || exclude.some((x) => ['~ALL', '~DEFAULT_BRANCH', 'refs/heads/main'].includes(x))) continue;
    if (rule.rules?.some((x) =>
      x.type === 'required_status_checks'
      && x.parameters?.strict_required_status_checks_policy === true)) strict = true;
  }
  if (!strict) throw new Error('STRICT_BASE_GUARD_REQUIRED: repository rules must require up-to-date check heads before any automatic merge.');

  const { data: pr } = await api(repo, '/pulls/' + n);
  if (decision(pr, repo) !== 'CHECK_ANCESTRY') throw new Error('PR is not eligible for a founder-approved one-shot merge.');
  if (pr.draft || pr.head.sha !== head || pr.base.sha !== base
    || pr.mergeable !== true || pr.mergeable_state !== 'clean') {
    throw new Error('Candidate is unreviewed, conflicted, blocked, or changed since exact approval.');
  }
  const { data: main } = await api(repo, '/branches/main');
  if (main.commit?.sha !== base) throw new Error('Main advanced after approval.');
  const { data: ancestry } = await api(repo, '/compare/' + head + '...' + base);
  if (ancestry.ahead_by !== 0) {
    throw new Error('Head is behind current base. Refresh first; prior approval does not carry forward.');
  }
  const { data: checks } = await api(repo, '/commits/' + head + '/check-runs?per_page=100');
  if (!Array.isArray(checks.check_runs) || checks.total_count > 100 || checks.check_runs.length === 0) {
    throw new Error('Exact-head check evidence unavailable or truncated.');
  }
  if (checks.check_runs.some((c) => c.head_sha !== head || c.status !== 'completed'
    || !['success', 'skipped'].includes(c.conclusion))) {
    throw new Error('All visible exact-head checks must finish without failures.');
  }

  // Re-read immediately before provider merge; the provider must still enforce
  // strict up-to-date protection and the exact head via --match-head-commit.
  const { data: fresh } = await api(repo, '/pulls/' + n);
  const { data: freshMain } = await api(repo, '/branches/main');
  if (fresh.head.sha !== head || fresh.base.sha !== base || freshMain.commit?.sha !== base
    || fresh.mergeable_state !== 'clean') {
    throw new Error('Candidate or base moved before one-shot merge. Reapproval required.');
  }
  const args = ['pr', 'merge', String(n), '--repo', repo, '--squash', '--match-head-commit', head];
  const ran = spawnSync('gh', args, {
    env: { ...process.env, GH_TOKEN: mergeToken },
    encoding: 'utf8',
    timeout: 45000,
  });
  if (ran.error || ran.status !== 0) {
    throw new Error('Provider rejected exact-head one-shot merge. No deferred merge was armed.');
  }
  log('MERGE_REQUESTED PR #' + n + ' exact head ' + head + ' base ' + base
    + '; verify main contains the result and successor workflows ran.');
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
