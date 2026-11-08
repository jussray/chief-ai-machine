/**
 * Read-only, trusted-main admission for manual authenticated Chief preview proof.
 * Never evaluates candidate source, never accepts an unsigned deployment URL,
 * and never opens Cloudflare credentials. No branch mutation or deploy here.
 */
import { appendFileSync } from 'node:fs';

const SHA = /^[0-9a-f]{40}$/;
const PREVIEW_HOST = /^[0-9a-f]{8}-chief-ai\.mcgill-raylene\.workers\.dev$/;
const CLOUDFLARE_CHECK_APP_ID = 85455;

function requireExact(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(name + ' required');
  return value.trim();
}

export function validatePreviewOrigin(raw) {
  const u = new URL(requireExact(raw, 'Preview origin'));
  if (
    u.protocol !== 'https:' || u.username || u.password || u.port
    || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')
    || !PREVIEW_HOST.test(u.hostname)
  ) throw new Error('Provider preview origin is not a single immutable Chief Worker hostname');
  return u.origin;
}

async function githubJson(path, env, fetchImpl) {
  const response = await fetchImpl('https://api.github.com/repos/' + env.GITHUB_REPOSITORY + path, {
    redirect: 'error',
    headers: {
      Authorization: 'Bearer ' + env.GH_TOKEN,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!response.ok) throw new Error('GitHub source validation failed with status ' + response.status);
  return response.json();
}

export async function discoverTrustedChiefPreview(env, fetchImpl = globalThis.fetch) {
  const owner = requireExact(env.REPOSITORY_OWNER, 'REPOSITORY_OWNER');
  if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/main') {
    throw new Error('Only a main-branch founder workflow_dispatch may perform protected proof');
  }
  if (env.GITHUB_ACTOR !== owner || env.TRIGGERING_ACTOR !== owner) {
    throw new Error('A direct founder actor is required');
  }
  if (env.AUTHORIZE_PROOF !== 'true' || env.GITHUB_RUN_ATTEMPT !== '1') {
    throw new Error('Explicit, first-attempt founder proof authorization is required');
  }
  if (env.GITHUB_REPOSITORY !== owner + '/chief-ai-machine') {
    throw new Error('Unexpected repository identity');
  }
  const trustedMain = requireExact(env.GITHUB_SHA, 'GITHUB_SHA');
  const expectedHead = requireExact(env.EXPECTED_HEAD_SHA, 'EXPECTED_HEAD_SHA');
  const prNumber = requireExact(env.AUTHORITY_PR, 'AUTHORITY_PR');
  if (!SHA.test(trustedMain) || !SHA.test(expectedHead) || !/^[1-9]\d*$/.test(prNumber)) {
    throw new Error('Invalid trusted main, candidate SHA or PR number');
  }
  requireExact(env.GH_TOKEN, 'GH_TOKEN');
  const [main, pr, provider] = await Promise.all([
    githubJson('/branches/main', env, fetchImpl),
    githubJson('/pulls/' + prNumber, env, fetchImpl),
    githubJson('/commits/' + expectedHead + '/check-runs?per_page=100', env, fetchImpl),
  ]);
  if (main.commit?.sha !== trustedMain) throw new Error('Trusted main moved');
  if (
    pr.number !== Number(prNumber)
    || pr.state !== 'open'
    || pr.base?.ref !== 'main'
    || pr.base?.repo?.full_name !== env.GITHUB_REPOSITORY
    || pr.head?.sha !== expectedHead
    || pr.head?.repo?.full_name !== env.GITHUB_REPOSITORY
  ) throw new Error('Open same-repository PR exact-head admission failed');
  const approvedBuild = (provider.check_runs || []).find(x => (
    x.name === 'Workers Builds: chief-ai'
    && x.head_sha === expectedHead
    && x.app?.id === CLOUDFLARE_CHECK_APP_ID
    && x.status === 'completed'
    && x.conclusion === 'success'
  ));
  if (!approvedBuild) throw new Error('No exact-head Cloudflare provider build receipt');
  const summary = String(approvedBuild.output?.summary || '');
  const previewMatch = summary.match(/(?:^|\n)Preview URL:\s*(https:\/\/[0-9a-f]{8}-chief-ai\.mcgill-raylene\.workers\.dev)(?:\s|$)/);
  if (!previewMatch) throw new Error('Provider build has no immutable Chief preview URL');
  return { previewOrigin: validatePreviewOrigin(previewMatch[1]), trustedMain, expectedHead };
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  discoverTrustedChiefPreview(process.env).then(({ previewOrigin }) => {
    // Do not log tokens or Cloudflare authentication headers.
    process.stdout.write('preview_origin=' + previewOrigin + '\n');
  }).catch((error) => {
    process.stderr.write('Trusted preview admission rejected: ' + (error.message || 'unknown') + '\n');
    process.exitCode = 1;
  });
}
