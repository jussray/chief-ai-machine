export const MERGE_INTENT_CONTRACT = 'chief-ai/merge-intent@v1';

const CURRENT_TRUTH_START = '<!-- chief-current-truth:start -->';
const CURRENT_TRUTH_END = '<!-- chief-current-truth:end -->';

const BLOCKING_MARKERS = Object.freeze([
  { code: 'explicit-do-not-merge', pattern: /^do\s+not\s+merge\b/i },
  { code: 'keep-draft', pattern: /^keep\s+draft\b/i },
  {
    code: 'stale-candidate',
    pattern: /^(?:(?:this\s+)?(?:pr|pull\s+request|candidate)\s+is\s+)?(?:downstream\s*\/\s*)?stale(?:\s*\/[^\n]{1,40})?\s+(?:candidate|pr|pull\s+request)\b/i,
  },
  {
    code: 'superseded',
    pattern: /^(?:(?:this\s+)?(?:pr|pull\s+request|candidate)\s+is\s+)?(?:\[superseded\]|superseded\b)/i,
  },
  { code: 'verification-only', pattern: /^verification\s+only\b/i },
  { code: 'merge-blocked', pattern: /^merge\s+blocked\b/i },
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function directiveLines(title, body) {
  const source = `${text(title)}\n${text(body)}`;
  const lines = [];
  let inFence = false;

  for (const rawLine of source.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (/^```/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence || /^>/.test(trimmed)) continue;

    let line = rawLine
      .replace(/`[^`]*`/g, '')
      .trim()
      .replace(/^#{1,6}\s*/, '')
      .replace(/^[-*+]\s+/, '')
      .trim();

    if ((line.startsWith('**') && line.endsWith('**')) || (line.startsWith('__') && line.endsWith('__'))) {
      line = line.slice(2, -2).trim();
    }

    if (line) lines.push(line);
  }

  return lines;
}

function countOccurrences(source, marker) {
  return source.split(marker).length - 1;
}

function currentTruthReceipt(body) {
  const source = text(body);
  const startCount = countOccurrences(source, CURRENT_TRUTH_START);
  const endCount = countOccurrences(source, CURRENT_TRUTH_END);

  if (startCount === 0 && endCount === 0) {
    return Object.freeze({ present: false, valid: true, headSha: null });
  }

  if (startCount !== 1 || endCount !== 1) {
    return Object.freeze({ present: true, valid: false, headSha: null });
  }

  const startIndex = source.indexOf(CURRENT_TRUTH_START);
  const endIndex = source.indexOf(CURRENT_TRUTH_END);
  if (endIndex <= startIndex) {
    return Object.freeze({ present: true, valid: false, headSha: null });
  }

  const scoped = source.slice(startIndex + CURRENT_TRUTH_START.length, endIndex);
  const liveHeadLine = scoped.match(/^\s*[-*+]?\s*live_head\s*:\s*(.+?)\s*$/im);
  if (!liveHeadLine) {
    return Object.freeze({ present: true, valid: false, headSha: null });
  }

  const normalized = liveHeadLine[1].replace(/[`*_]/g, '').trim();
  const shaMatch = normalized.match(/@([0-9a-fA-F]{40})$/);
  if (!shaMatch) {
    return Object.freeze({ present: true, valid: false, headSha: null });
  }

  return Object.freeze({
    present: true,
    valid: true,
    headSha: shaMatch[1].toLowerCase(),
  });
}

/**
 * Convert current human merge intent into a deterministic fail-closed signal.
 *
 * This evaluator does not authorize merge. It can only say that a candidate is
 * explicitly ineligible for merge. Provider rules must require its check before
 * this becomes an enforcement boundary.
 *
 * Negative markers are recognized only when they are written as directive/status
 * lines. Quoted examples, code fences, inline-code examples, and incidental prose
 * do not silently acquire merge-blocking authority.
 *
 * When the PR body carries a machine-current-truth receipt and the caller supplies
 * the authoritative PR head SHA, that receipt must name the same head. Stale or
 * malformed receipts fail closed and their body directives are quarantined so a
 * predecessor founder decision cannot impersonate current merge intent.
 */
export function evaluateMergeIntent({ baseRef, title, body, isDraft, headSha }) {
  const base = text(baseRef);

  if (base !== 'main') {
    return Object.freeze({
      contract: MERGE_INTENT_CONTRACT,
      applies: false,
      mergeIntentClear: true,
      reasons: Object.freeze([]),
      nextGate: 'Integration branch only; main-merge intent gate is not applicable.',
    });
  }

  const reasons = [];
  if (isDraft === true) reasons.push('draft');

  const authoritativeHeadSha = text(headSha).toLowerCase();
  const receipt = currentTruthReceipt(body);
  let bodyForDirectives = body;

  if (authoritativeHeadSha && receipt.present) {
    if (!receipt.valid) {
      reasons.push('current_truth_invalid');
      bodyForDirectives = '';
    } else if (receipt.headSha !== authoritativeHeadSha) {
      reasons.push('current_truth_stale');
      bodyForDirectives = '';
    }
  }

  const lines = directiveLines(title, bodyForDirectives);
  for (const marker of BLOCKING_MARKERS) {
    if (lines.some((line) => marker.pattern.test(line)) && !reasons.includes(marker.code)) {
      reasons.push(marker.code);
    }
  }

  const currentTruthBlocked = reasons.includes('current_truth_stale') || reasons.includes('current_truth_invalid');

  return Object.freeze({
    contract: MERGE_INTENT_CONTRACT,
    applies: true,
    mergeIntentClear: reasons.length === 0,
    reasons: Object.freeze(reasons),
    nextGate: currentTruthBlocked
      ? 'Refresh the machine-current-truth live_head to the exact current PR head before evaluating present-tense merge intent.'
      : reasons.length === 0
        ? 'Merge intent is clear; all independent source, review, proof, and provider gates still apply.'
        : 'Keep merge blocked until draft/keep-draft/stale/superseded/verification-only markers are removed by an explicit current decision.',
  });
}
