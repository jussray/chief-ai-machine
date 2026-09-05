export const MERGE_INTENT_CONTRACT = 'chief-ai/merge-intent@v1';

const BLOCKING_MARKERS = Object.freeze([
  { code: 'explicit-do-not-merge', pattern: /^do\s+not\s+merge\b/i },
  { code: 'keep-draft', pattern: /^keep\s+draft\b/i },
  {
    code: 'stale-candidate',
    pattern: /^(?:(?:this\s+)?(?:pr|pull\s+request|candidate)\s+is\s+)?(?:downstream\s*\/\s*)?stale(?:\s*\/[^\n]{1,40})?\s+(?:candidate|pr|pull\s+request)\b/i,
  },
  {
    code: 'superseded',
    pattern: /^(?:\[superseded\](?:\s|$)|(?:(?:this\s+)?(?:pr|pull\s+request|candidate)\s+is\s+)?superseded(?:\s|[.:;,(]|$))/i,
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
      .replace(/^\d+[.)]\s+/, '')
      .trim();

    if ((line.startsWith('**') && line.endsWith('**')) || (line.startsWith('__') && line.endsWith('__'))) {
      line = line.slice(2, -2).trim();
    }

    if (line) lines.push(line);
  }

  return lines;
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
 */
export function evaluateMergeIntent({ baseRef, title, body, isDraft }) {
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

  const lines = directiveLines(title, body);
  for (const marker of BLOCKING_MARKERS) {
    if (lines.some((line) => marker.pattern.test(line)) && !reasons.includes(marker.code)) {
      reasons.push(marker.code);
    }
  }

  return Object.freeze({
    contract: MERGE_INTENT_CONTRACT,
    applies: true,
    mergeIntentClear: reasons.length === 0,
    reasons: Object.freeze(reasons),
    nextGate: reasons.length === 0
      ? 'Merge intent is clear; all independent source, review, proof, and provider gates still apply.'
      : 'Keep merge blocked until draft/keep-draft/stale/superseded/verification-only markers are removed by an explicit current decision.',
  });
}
