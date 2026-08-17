import { describe, expect, it } from 'vitest';
import {
  auditActionReference,
  scanWorkflowText,
} from '../scripts/verify-operational-authority.mjs';

describe('operational authority contract', () => {
  it('accepts local actions and full-SHA third-party actions', () => {
    expect(auditActionReference('./.github/actions/local')).toMatchObject({ ok: true });
    expect(auditActionReference('actions/checkout@11d5960a326750d5838078e36cf38b85af677262'))
      .toMatchObject({ ok: true, classification: 'immutable-action-sha' });
  });

  it('rejects mutable tags, branches, and short SHAs', () => {
    for (const reference of [
      'actions/checkout@v4',
      'actions/setup-node@main',
      'actions/upload-artifact@ea165f8',
    ]) {
      expect(auditActionReference(reference)).toMatchObject({
        ok: false,
        classification: 'mutable-action-reference',
      });
    }
  });

  it('reports the exact workflow and line containing mutable authority', () => {
    const findings = scanWorkflowText(`name: Example\nsteps:\n  - uses: actions/checkout@v4\n`, '.github/workflows/example.yml');
    expect(findings).toEqual([
      expect.objectContaining({
        workflow: '.github/workflows/example.yml',
        line: 3,
        ok: false,
        reference: 'actions/checkout@v4',
      }),
    ]);
  });
});
