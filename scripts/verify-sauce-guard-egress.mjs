// Sauce Guard companion: blocks newly added dynamic log sinks.
// The canonical Sauce Guard skill in FCR governs public communication.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = /^(?:scripts|src|worker|app|server|api|functions|supabase\/functions)\/.*\.(?:[cm]?js|jsx|tsx?)$/;
const LOG_SINK = /\b(?:console\.(?:log|info|warn|error|debug)|(?:logger|log)\.(?:log|info|warn|error|debug)|process\.(?:stdout|stderr)\.write)\s*\(/;
const FIXED_EVENT = /^\s*(?:console\.(?:log|info|warn|error|debug)|(?:logger|log)\.(?:log|info|warn|error|debug)|process\.(?:stdout|stderr)\.write)\s*\(\s*(['"])[A-Z][A-Z0-9_]{2,100}\1\s*\)\s*;?\s*$/;

export function scanAddedLines(diffText) {
  let filename = '';
  let line = 0;
  const findings = [];
  for (const row of String(diffText).split('\n')) {
    const pathMatch = row.match(/^\+\+\+ b\/(.+)$/);
    if (pathMatch) { filename = pathMatch[1]; continue; }
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (!filename || !SOURCE_PATH.test(filename)) continue;
    if (row.startsWith('+') && !row.startsWith('+++')) {
      const added = row.slice(1);
      if (LOG_SINK.test(added) && !FIXED_EVENT.test(added)) {
        findings.push({ path: filename, line, reason: 'SAUCE_GUARD_DYNAMIC_LOG' });
      }
      line += 1;
    } else if (row.startsWith(' ')) {
      line += 1;
    }
  }
  return findings;
}

export function auditChangedLogs({ base, root = ROOT } = {}) {
  if (typeof base !== 'string' || !/^[a-f0-9]{40}$/i.test(base)) {
    throw new Error('SAUCE_GUARD_INVALID_BASE');
  }
  const diff = execFileSync('git', [
    'diff', '--unified=0', '--no-ext-diff', '--diff-filter=ACMRT',
    base, 'HEAD', '--', 'scripts', 'src', 'worker', 'app', 'server',
    'api', 'functions', 'supabase/functions',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  return scanAddedLines(diff);
}

if (import.meta.main) {
  const base = process.argv.find(x => x.startsWith('--base='))?.slice(7);
  try {
    const violations = auditChangedLogs({ base });
    if (violations.length) {
      // Never write the offending source, logger argument, provider payload or secret.
      console.error('SAUCE_GUARD_DYNAMIC_LOG_BLOCKED');
      process.exitCode = 1;
    } else {
      console.log('SAUCE_GUARD_CHANGED_LOGS_CLEAR');
    }
  } catch {
    console.error('SAUCE_GUARD_AUDIT_FAILED_CLOSED');
    process.exitCode = 1;
  }
}
