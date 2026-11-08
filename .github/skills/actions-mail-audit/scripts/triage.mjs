import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL, URL } from 'node:url';
import process from 'node:process';

const REPO = /^jussray\/[a-z0-9_.-]+$/i;
const RUN_PATH = /^\/(jussray)\/([a-z0-9_.-]+)\/actions\/runs\/([1-9]\d*)\/?$/i;
const FAILURE = new Set(['failure', 'timed_out', 'action_required', 'cancelled']);
const MAIL_FIELDS = ['mailbox', 'message_id', 'received_at', 'labels', 'run_url', 'kind'];

export function parseRunUrl(value, scopedRepo) {
  if (typeof value !== 'string' || !REPO.test(scopedRepo || '')) return null;
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.port) return null;
  const match = RUN_PATH.exec(url.pathname);
  if (!match) return null;
  const repo = match[1] + '/' + match[2];
  if (repo.toLowerCase() !== scopedRepo.toLowerCase()) return null;
  return { repo: scopedRepo, runId: match[3], url: 'https://github.com/' + scopedRepo + '/actions/runs/' + match[3] };
}

export function classifyRun(run, currentHead) {
  if (!run || !/^[0-9a-f]{40}$/.test(run.head_sha || '') || !/^[0-9a-f]{40}$/.test(currentHead || '')) return 'UNKNOWN';
  if (run.head_sha !== currentHead) return 'STALE_HEAD_NOT_PROVEN_FIXED';
  if (run.status !== 'completed') return 'PENDING';
  if (FAILURE.has(run.conclusion)) return 'CURRENT_RED';
  if (run.conclusion === 'success') return 'CURRENT_RUN_GREEN_ONLY';
  return 'UNKNOWN';
}

function fingerprint(parts) {
  return createHash('sha256').update(parts.join('|')).digest('hex');
}

export async function reconcileNotices(notices, { repo, readRun, readBranch }) {
  if (!REPO.test(repo || '')) throw new Error('invalid jussray repository scope');
  if (!Array.isArray(notices)) throw new Error('notices must be an array');
  const result = [];
  const seen = new Set();
  for (const entry of notices) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    if (Object.keys(entry).some(k => !MAIL_FIELDS.includes(k))) throw new Error('notice contains disallowed fields');
    const kind = entry.kind === 'security' ? 'security' : 'actions';
    const parsed = parseRunUrl(entry.run_url, repo);
    const messageId = typeof entry.message_id === 'string' ? entry.message_id.slice(0, 80) : '';
    const mailbox = typeof entry.mailbox === 'string' ? entry.mailbox.slice(0, 120) : '';
    const receivedAt = typeof entry.received_at === 'string' ? entry.received_at.slice(0, 40) : '';
    const labels = Array.isArray(entry.labels) ? entry.labels.filter(x => ['INBOX','SPAM','TRASH'].includes(x)) : [];
    const key = parsed ? 'run:' + parsed.runId : 'notice:' + messageId;
    if (seen.has(key)) continue;
    seen.add(key);
    const item = { schema: 'juss.actions-mail-audit@v1', repo, mailbox, message_id: messageId, received_at: receivedAt, labels, source_url: parsed?.url || null, run_id: parsed?.runId || null, status: 'UNKNOWN', head: null, current_branch_head: null, evidence: 'mail_is_a_signal_not_proof', event_fingerprint: '' };
    if (kind === 'security') {
      item.status = 'SECURITY_TRIAGE_UNVERIFIED';
      item.evidence = 'private_provider_incident_readback_required';
    }
    if (parsed) {
      try {
        const run = await readRun(repo, parsed.runId);
        const branch = typeof run?.head_branch === 'string' ? run.head_branch : '';
        if (!branch || branch.length > 180) throw new Error('run branch unavailable');
        const current = await readBranch(repo, branch);
        item.head = /^[0-9a-f]{40}$/.test(run.head_sha || '') ? run.head_sha : null;
        item.current_branch_head = /^[0-9a-f]{40}$/.test(current || '') ? current : null;
        const checked = classifyRun(run, current);
        // A security report is never cleared by an unrelated successful Actions run.
        item.status = kind === 'security' ? 'SECURITY_TRIAGE_UNVERIFIED' : checked;
        item.evidence = 'github_run_and_current_branch_readback';
      } catch {
        item.status = kind === 'security' ? 'SECURITY_TRIAGE_UNVERIFIED' : 'COVERAGE_BLOCKED';
        item.evidence = 'github_readback_unavailable';
      }
    }
    item.event_fingerprint = fingerprint([repo, key, item.head || '', item.status]);
    result.push(item);
  }
  return result;
}

async function githubJson(path, token) {
  const response = await globalThis.fetch('https://api.github.com' + path, {
    headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
    redirect: 'error',
    signal: globalThis.AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error('GitHub readback unavailable');
  return response.json();
}

export async function runCli() {
  const repo = process.env.GITHUB_REPOSITORY || '';
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
  if (!REPO.test(repo)) throw new Error('GITHUB_REPOSITORY must scope one jussray repository');
  if (!token) throw new Error('GitHub read-only token unavailable');
  let text = '';
  for await (const chunk of process.stdin) {
    text += chunk;
    if (text.length > 256000) throw new Error('notice input too large');
  }
  const parsed = JSON.parse(text || '{}');
  if (Object.keys(parsed).some(x => x !== 'notices' && x !== 'schema')) throw new Error('only sanitized notice metadata accepted');
  if (parsed.schema !== 'juss.actions-mail-input@v1') throw new Error('input schema mismatch');
  const output = await reconcileNotices(parsed.notices, {
    repo,
    readRun: (r, id) => githubJson('/repos/' + r + '/actions/runs/' + id, token),
    readBranch: async (r, b) => (await githubJson('/repos/' + r + '/branches/' + encodeURIComponent(b), token)).commit?.sha,
  });
  process.stdout.write(JSON.stringify({ schema: 'juss.actions-mail-result@v1', repo, coverage: 'github_readback', results: output }) + '\n');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runCli().catch(() => {
    process.stderr.write('BLOCKED: input, scope, or GitHub readback unavailable; no mutation performed\n');
    process.exitCode = 2;
  });
}
