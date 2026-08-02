const REQUIRED_EVIDENCE_MARKERS = [
  'authoritative repository',
  'VERIFIED',
  'INFERRED',
  'UNKNOWN',
  'BLOCKED',
];

export function hasEvidenceFirstContract(text = '') {
  const value = String(text || '');
  return REQUIRED_EVIDENCE_MARKERS.every((marker) => value.includes(marker));
}

export function applyEvidenceFirstContract(text = '') {
  const value = String(text || '').trim();
  if (!value || hasEvidenceFirstContract(value)) return value;

  return [
    value,
    '',
    'Evidence-first contract:',
    '- Establish the authoritative repository, branch or PR, and exact head before acting.',
    '- Label material findings VERIFIED, INFERRED, UNKNOWN, or BLOCKED.',
    '- Exhaust repository evidence before asking questions.',
    '- Require rollback and a stop condition.',
    '- Use Playwright proof when rendered UI or browser behavior is involved.',
  ].join('\n');
}
