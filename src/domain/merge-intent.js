export const MERGE_INTENT_CONTRACT = 'chief-ai/merge-intent@v1';

const BLOCKING_MARKERS = Object.freeze([
  { code: 'explicit-do-not-merge', pattern: /\bdo\s+not\s+merge\b/i },
  { code: 'stale-candidate', pattern: /\bstale\s+(?:candidate|pr|pull\s+request)\b/i },
  { code: 'superseded', pattern: /\bsuperseded\b/i },
  { code: 'verification-only', pattern: /\bverification\s+only\b/i },
  { code: 'merge-blocked', pattern: /\bmerge\s+blocked\b/i },
]);

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Convert human merge intent into a deterministic fail-closed signal.
 *
 * This evaluator does not authorize merge. It can only say that a candidate is
 * explicitly ineligible for merge. Provider rules must require its check before
 * this becomes an enforcement boundary.
 */
export function evaluateMergeIntent({ baseRef, title, body, isDraft }) {
  const base = text(baseRef);
  const combined = `${text(title)}\n${text(body)}`;

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
  for (const marker of BLOCKING_MARKERS) {
    if (marker.pattern.test(combined) && !reasons.includes(marker.code)) reasons.push(marker.code);
  }

  return Object.freeze({
    contract: MERGE_INTENT_CONTRACT,
    applies: true,
    mergeIntentClear: reasons.length === 0,
    reasons: Object.freeze(reasons),
    nextGate: reasons.length === 0
      ? 'Merge intent is clear; all independent source, review, proof, and provider gates still apply.'
      : 'Keep merge blocked until draft/stale/superseded/verification-only markers are removed by an explicit current decision.',
  });
}
