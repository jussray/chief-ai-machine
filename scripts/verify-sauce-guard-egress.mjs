// Privacy guard for changed logger calls. Canonical publication governance remains
// jussray/founder-control-room/.agents/skills/sauce-guard/SKILL.md.
// Uses TypeScript's parser so multiline calls and argument-only edits are inspected.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_PATH = /^(?:scripts|src|worker|app|server|api|functions|supabase\/functions|plugins\/proofmode\/src)\/.*\.(?:[cm]?js|jsx|tsx?|mts|cts)$/;
const EVENT = /^[A-Z][A-Z0-9_]{2,100}$/;
// Structured/debug console methods can disclose entire user or provider objects;
// only level-based fixed event codes may be used by changed logging calls.
const SAFE_EVENT_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug']);
const CONSOLE_OUTPUT_METHODS = new Set([
  ...SAFE_EVENT_METHODS,
  'dir', 'dirxml', 'table', 'trace', 'assert', 'count', 'countReset',
  'group', 'groupCollapsed', 'groupEnd', 'time', 'timeLog', 'timeEnd',
  'profile', 'profileEnd',
]);

function changedLines(diff) {
  const result = new Map();
  let filename = '';
  let line = 0;
  for (const row of String(diff).split('\n')) {
    const file = row.match(/^\+\+\+ b\/(.+)$/);
    if (file) {
      filename = file[1];
      if (SOURCE_PATH.test(filename) && !result.has(filename)) result.set(filename, new Map());
      continue;
    }
    const hunk = row.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) { line = Number(hunk[1]); continue; }
    if (!result.has(filename)) continue;
    if (row.startsWith('+') && !row.startsWith('+++')) {
      result.get(filename).set(line, row.slice(1));
      line += 1;
    } else if (row.startsWith(' ')) line += 1;
  }
  return result;
}

function loggerTarget(expr) {
  // Include constant bracket access such as console['table'] and split calls.
  let name, owner;
  if (ts.isPropertyAccessExpression(expr)) {
    name = expr.name.text;
    owner = expr.expression;
  } else if (ts.isElementAccessExpression(expr)
    && ts.isStringLiteralLike(expr.argumentExpression)) {
    name = expr.argumentExpression.text;
    owner = expr.expression;
  } else {
    return null;
  }
  if (ts.isIdentifier(owner)) {
    if (owner.text === 'console' && CONSOLE_OUTPUT_METHODS.has(name)) {
      return { fixedEventAllowed: SAFE_EVENT_METHODS.has(name) };
    }
    if ((owner.text === 'logger' || owner.text === 'log') && SAFE_EVENT_METHODS.has(name)) {
      return { fixedEventAllowed: true };
    }
  }
  if (name === 'write'
    && ts.isPropertyAccessExpression(owner)
    && (owner.name.text === 'stdout' || owner.name.text === 'stderr')
    && ts.isIdentifier(owner.expression)
    && owner.expression.text === 'process') {
    return { fixedEventAllowed: true };
  }
  return null;
}

function inspectSource(filename, text, added) {
  if (!added?.size) return [];
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true,
    /\.tsx$|\.jsx$/.test(filename) ? ts.ScriptKind.TSX : /\.tsx?$|\.mts$|\.cts$/.test(filename) ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const findings = [];
  function visit(node) {
    const target = ts.isCallExpression(node) ? loggerTarget(node.expression) : null;
    if (target) {
      const from = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const to = source.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
      const affected = [...added.keys()].some(x => x >= from && x <= to);
      if (affected) {
        const arg = node.arguments[0];
        const safe = target.fixedEventAllowed
          && node.arguments.length === 1
          && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))
          && EVENT.test(arg.text);
        if (!safe) findings.push({ path: filename, line: from, reason: 'SAUCE_GUARD_DYNAMIC_LOG' });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return findings;
}

// A source snapshot is required for production diffs; reconstructed added-line
// snapshots are only a conservative unit-test convenience.
export function scanAddedLines(diff, sources = {}) {
  const all = changedLines(diff);
  const findings = [];
  for (const [filename, added] of all) {
    if (!added.size) continue;
    const text = Object.prototype.hasOwnProperty.call(sources, filename)
      ? sources[filename]
      : Array.from({ length: Math.max(...added.keys()) }, (_, n) => added.get(n + 1) ?? '').join('\n');
    findings.push(...inspectSource(filename, text, added));
  }
  return findings;
}

export function auditChangedLogs({ base, root = ROOT } = {}) {
  if (typeof base !== 'string' || !/^[a-f0-9]{40}$/i.test(base) || /^0{40}$/.test(base)) {
    throw new Error('SAUCE_GUARD_INVALID_BASE');
  }
  const diff = execFileSync('git', [
    'diff', '--unified=0', '--no-ext-diff', '--diff-filter=ACMRT',
    base, 'HEAD', '--', 'scripts', 'src', 'worker', 'app', 'server',
    'api', 'functions', 'supabase/functions', 'plugins/proofmode/src',
  ], { cwd: root, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 });
  const map = changedLines(diff);
  const sources = Object.fromEntries([...map.keys()]
    .filter(p => map.get(p).size > 0)
    .map(p => [p, readFileSync(path.join(root, p), 'utf8')]));
  return scanAddedLines(diff, sources);
}

if (import.meta.main) {
  try {
    const base = process.argv.find(x => x.startsWith('--base='))?.slice(7);
    if (auditChangedLogs({ base }).length) {
      console.error('SAUCE_GUARD_DYNAMIC_LOG_BLOCKED');
      process.exitCode = 1;
    } else console.log('SAUCE_GUARD_CHANGED_LOGS_CLEAR');
  } catch {
    // Never echo source lines, provider messages, request data or subprocess output.
    console.error('SAUCE_GUARD_AUDIT_FAILED_CLOSED');
    process.exitCode = 1;
  }
}
