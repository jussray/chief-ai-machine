const REQUIRED_EVIDENCE_MARKERS = [
  'authoritative repository',
  'target branch or pr',
  'exact head',
  'evidence hierarchy',
  'verified',
  'inferred',
  'unknown',
  'blocked',
  'exhaust available',
  'minimal reversible',
  'stop condition',
  'rollback',
  'playwright',
];

export const EVIDENCE_FIRST_FLOOR = `

EVIDENCE-FIRST FLOOR:
- For repository, code, deployment, or runtime work, establish the Authoritative repository, Target branch or PR, and Exact head before recommending action.
- For non-repository work, establish the authoritative source, supplied input, and current version or date instead of inventing missing context.
- Evidence hierarchy: source of truth first; then current diff or state; checks, logs, and artifacts; rendered or runtime behavior; summaries last.
- Label every material conclusion VERIFIED, INFERRED, UNKNOWN, or BLOCKED.
- Exhaust available evidence before asking questions. Never turn an inspectable fact into a question for the user.
- Recommend one minimal reversible next action. State the rollback and stop condition before implementation, approval, publishing, or a claim of completion.
- When UI or rendered behavior is involved, require Playwright evidence from the real path before calling the work done.
- For generative-only work, keep the result as a reversible draft and preserve the original as the rollback.`;

export function hasEvidenceFirstContract(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.toLowerCase();
  return REQUIRED_EVIDENCE_MARKERS.every((marker) => normalized.includes(marker));
}

export function applyEvidenceFirstContract(value) {
  if (typeof value !== 'string' || value.trim() === '') return '';
  if (hasEvidenceFirstContract(value)) return value;
  return `${value.trimEnd()}${EVIDENCE_FIRST_FLOOR}`;
}

export function renderPromptVariant(prompt, platform, replacements = {}) {
  const versions = prompt?.versions || {};
  const fallback = Object.values(versions).find((value) => typeof value === 'string');
  let rendered = typeof versions[platform] === 'string' ? versions[platform] : fallback || '';

  for (const [placeholder, value] of Object.entries(replacements || {})) {
    const token = placeholder.startsWith('[') && placeholder.endsWith(']')
      ? placeholder
      : `[${placeholder}]`;
    rendered = rendered.replaceAll(token, String(value ?? ''));
  }

  return applyEvidenceFirstContract(rendered);
}
