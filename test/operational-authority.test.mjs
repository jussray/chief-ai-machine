import { describe, expect, it } from 'vitest';
import {
  applyWorkflowAuthorityWaivers,
  auditActionReference,
  scanWorkflowText,
  validateWorkflowAuthorityWaivers,
} from '../scripts/verify-operational-authority.mjs';

describe('operational authority contract', () => {
  it('accepts local actions and full-SHA third-party actions', () => {
    expect(auditActionReference('./.github/actions/local')).toMatchObject({ ok: true });
    expect(auditActionReference('actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1'))
      .toMatchObject({ ok: true, classification: 'immutable-action-sha' });
  });

  it('rejects mutable tags, branches, and short SHAs', () => {
    for (const reference of [
      'actions/checkout@v7',
      'actions/setup-node@main',
      'actions/upload-artifact@043fb46',
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

  it('requires immutable checkout steps to opt out of persisted credentials', () => {
    const reference = 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1';
    const unsafe = scanWorkflowText(`steps:\n  - uses: ${reference}\n`, '.github/workflows/unsafe.yml');
    expect(unsafe).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'checkout-persist-credentials-enabled',
        ok: false,
        reference,
      }),
    ]));

    const safe = scanWorkflowText(
      `steps:\n  - uses: ${reference}\n    with:\n      persist-credentials: false\n`,
      '.github/workflows/safe.yml',
    );
    expect(safe.filter((finding) => !finding.ok)).toHaveLength(0);
  });

  it('waives only one exact workflow/reference pair', () => {
    const findings = [
      ...scanWorkflowText('steps:\n  - uses: actions/checkout@v4\n', '.github/workflows/runtime.yml'),
      ...scanWorkflowText('steps:\n  - uses: actions/checkout@v4\n', '.github/workflows/other.yml'),
    ];
    const waivers = [{
      workflow: '.github/workflows/runtime.yml',
      reference: 'actions/checkout@v4',
      tracking: '#92',
      removalGate: 'remove after runtime repair lands',
    }];
    const result = applyWorkflowAuthorityWaivers(findings, waivers);

    expect(result.findings.find((item) => item.workflow.endsWith('runtime.yml'))?.waived).toBe(true);
    expect(result.findings.find((item) => item.workflow.endsWith('other.yml'))?.waived).toBe(false);
    expect(result.waiversApplied).toHaveLength(1);
    expect(result.unusedWaivers).toHaveLength(0);
  });

  it('rejects wildcard, immutable-reference, and untracked waiver definitions', () => {
    const invalid = validateWorkflowAuthorityWaivers([
      {
        workflow: '.github/workflows/*.yml',
        reference: 'actions/checkout@v4',
        tracking: '#92',
        removalGate: 'later',
      },
      {
        workflow: '.github/workflows/runtime.yml',
        reference: 'actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1',
        tracking: '#92',
        removalGate: 'later',
      },
      {
        workflow: '.github/workflows/runtime.yml',
        reference: 'actions/setup-node@v4',
        tracking: '',
        removalGate: 'later',
      },
    ]);
    expect(invalid).toHaveLength(3);
  });

  it('makes a waiver self-expire when the mutable reference disappears', () => {
    const findings = scanWorkflowText(
      'steps:\n  - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1\n    with:\n      persist-credentials: false\n',
      '.github/workflows/runtime.yml',
    );
    const result = applyWorkflowAuthorityWaivers(findings, [{
      workflow: '.github/workflows/runtime.yml',
      reference: 'actions/checkout@v4',
      tracking: '#92',
      removalGate: 'remove after runtime repair lands',
    }]);
    expect(result.waiversApplied).toHaveLength(0);
    expect(result.unusedWaivers).toEqual([
      expect.objectContaining({
        classification: 'unused-authority-waiver',
        tracking: '#92',
      }),
    ]);
  });
});
