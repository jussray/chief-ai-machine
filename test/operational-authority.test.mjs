import { describe, expect, it } from 'vitest';
import {
  applyWorkflowAuthorityWaivers,
  auditActionReference,
  auditWorkflowResponsibilities,
  canonicalizeVerificationCommand,
  extractRunCommands,
  scanWorkflowBudget,
  scanWorkflowText,
  validateTemporalAuthority,
  validateWorkflowAuthorityWaivers,
  validateWorkflowResponsibilityMirrors,
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

  it('requires pull-request workflows to cancel superseded runs', () => {
    const unsafe = scanWorkflowText(
      'name: Unsafe\non:\n  pull_request:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n',
      '.github/workflows/unsafe-pr.yml',
    );
    expect(unsafe).toEqual(expect.arrayContaining([
      expect.objectContaining({
        classification: 'superseded-pr-runs-not-cancelled',
        ok: false,
      }),
    ]));

    const safe = scanWorkflowText(
      'name: Safe\non:\n  pull_request:\n    branches: [main]\nconcurrency:\n  group: safe-${{ github.event.pull_request.number || github.ref }}\n  cancel-in-progress: true\njobs:\n  test:\n    runs-on: ubuntu-latest\n',
      '.github/workflows/safe-pr.yml',
    );
    expect(safe.filter((finding) => finding.classification === 'superseded-pr-runs-not-cancelled')).toHaveLength(0);
  });

  it('does not require PR concurrency for workflows without pull_request triggers', () => {
    const findings = scanWorkflowText(
      'name: Issue only\non:\n  issues:\n    types: [closed]\njobs:\n  enforce:\n    runs-on: ubuntu-latest\n',
      '.github/workflows/issues.yml',
    );
    expect(findings.filter((finding) => finding.classification === 'superseded-pr-runs-not-cancelled')).toHaveLength(0);
  });

  it('rejects duplicate full-suite coverage execution inside one workflow, including multiline run blocks', () => {
    const duplicate = scanWorkflowBudget(
      'jobs:\n  unit:\n    steps:\n      - run: npm test -- --coverage\n  sonar:\n    steps:\n      - run: |\n          npm test -- --coverage\n',
      '.github/workflows/quality.yml',
    );
    expect(duplicate.fullCoverageExecutions).toBe(2);
    expect(duplicate.violations).toEqual([
      expect.objectContaining({
        classification: 'duplicate-full-suite-coverage-execution',
        count: 2,
      }),
    ]);

    const reused = scanWorkflowBudget(
      'jobs:\n  unit:\n    steps:\n      - run: npm test -- --coverage\n  sonar:\n    steps:\n      - uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c\n',
      '.github/workflows/quality.yml',
    );
    expect(reused.fullCoverageExecutions).toBe(1);
    expect(reused.violations).toHaveLength(0);
  });

  it('extracts inline and multiline run commands without treating path declarations as execution', () => {
    const commands = extractRunCommands(
      'paths:\n  - scripts/verify-cookie-contract.mjs\nsteps:\n  - run: npm run verify:cookies\n  - run: |\n      set -euo pipefail\n      node scripts/verify-founder-chief-pair.mjs\n',
    );
    expect(commands).toEqual([
      { line: 4, command: 'npm run verify:cookies' },
      { line: 5, command: 'set -euo pipefail\nnode scripts/verify-founder-chief-pair.mjs' },
    ]);
  });

  it('canonicalizes npm verification scripts to the command they actually execute', () => {
    const scripts = {
      'verify:cookies': 'node scripts/verify-cookie-contract.mjs',
    };
    expect(canonicalizeVerificationCommand('npm run verify:cookies', scripts))
      .toBe('node scripts/verify-cookie-contract.mjs');
    expect(canonicalizeVerificationCommand('npm ci', scripts)).toBeNull();
  });

  it('blocks a duplicated verification responsibility without an exact mirror disposition', () => {
    const result = auditWorkflowResponsibilities({
      workflows: [
        { workflow: '.github/workflows/owner.yml', text: 'steps:\n  - run: npm run verify:cookies\n' },
        { workflow: '.github/workflows/mirror.yml', text: 'steps:\n  - run: node scripts/verify-cookie-contract.mjs\n' },
      ],
      packageScripts: { 'verify:cookies': 'node scripts/verify-cookie-contract.mjs' },
      mirrors: [],
    });
    expect(result.violations).toEqual([
      expect.objectContaining({
        classification: 'duplicate-workflow-verification-responsibility',
        command: 'node scripts/verify-cookie-contract.mjs',
      }),
    ]);
  });

  it('allows only the exact tracked verification mirror and rejects a third workflow', () => {
    const mirror = {
      command: 'node scripts/verify-cookie-contract.mjs',
      owner: '.github/workflows/owner.yml',
      mirror: '.github/workflows/mirror.yml',
      tracking: '#96',
      rationale: 'Preserve provider check identity until ruleset readback is available.',
      removalGate: 'Remove after provider readback proves the mirror is not required.',
    };
    const baseWorkflows = [
      { workflow: '.github/workflows/owner.yml', text: 'steps:\n  - run: npm run verify:cookies\n' },
      { workflow: '.github/workflows/mirror.yml', text: 'steps:\n  - run: node scripts/verify-cookie-contract.mjs\n' },
    ];
    const allowed = auditWorkflowResponsibilities({
      workflows: baseWorkflows,
      packageScripts: { 'verify:cookies': 'node scripts/verify-cookie-contract.mjs' },
      mirrors: [mirror],
    });
    expect(allowed.violations).toHaveLength(0);
    expect(allowed.unusedMirrors).toHaveLength(0);
    expect(allowed.intentionalMirrors).toEqual([expect.objectContaining({ tracking: '#96' })]);

    const widened = auditWorkflowResponsibilities({
      workflows: [
        ...baseWorkflows,
        { workflow: '.github/workflows/third.yml', text: 'steps:\n  - run: node scripts/verify-cookie-contract.mjs\n' },
      ],
      packageScripts: { 'verify:cookies': 'node scripts/verify-cookie-contract.mjs' },
      mirrors: [mirror],
    });
    expect(widened.violations).toEqual([
      expect.objectContaining({
        classification: 'duplicate-workflow-verification-responsibility',
        undisposedWorkflows: ['.github/workflows/third.yml'],
      }),
    ]);
  });

  it('makes an intentional verification mirror self-expire when the duplicate disappears', () => {
    const mirror = {
      command: 'node scripts/verify-cookie-contract.mjs',
      owner: '.github/workflows/owner.yml',
      mirror: '.github/workflows/mirror.yml',
      tracking: '#96',
      rationale: 'Temporary mirror.',
      removalGate: 'Remove after provider readback.',
    };
    const result = auditWorkflowResponsibilities({
      workflows: [
        { workflow: '.github/workflows/owner.yml', text: 'steps:\n  - run: node scripts/verify-cookie-contract.mjs\n' },
      ],
      mirrors: [mirror],
    });
    expect(result.unusedMirrors).toEqual([
      expect.objectContaining({
        classification: 'unused-workflow-responsibility-mirror',
        tracking: '#96',
      }),
    ]);
  });

  it('rejects wildcard, untracked, and self-owned verification mirror definitions', () => {
    const invalid = validateWorkflowResponsibilityMirrors([
      {
        command: 'node scripts/verify-cookie-contract.mjs',
        owner: '.github/workflows/*.yml',
        mirror: '.github/workflows/cookie.yml',
        tracking: '#96',
        rationale: 'bad',
        removalGate: 'later',
      },
      {
        command: 'node scripts/verify-cookie-contract.mjs',
        owner: '.github/workflows/cookie.yml',
        mirror: '.github/workflows/cookie.yml',
        tracking: '',
        rationale: '',
        removalGate: '',
      },
    ]);
    expect(invalid).toHaveLength(2);
  });

  it('keeps Current You authoritative while FutureYou remains advisory', () => {
    const valid = {
      currentFounderIntent: 'authoritative-for-founder-preferences-and-goals',
      futureYou: 'advisory-only',
      historicalIntentOnConflict: 'superseded-reconfirm-before-use',
      runtimeFacts: 'provider-evidence-authoritative',
      executionAuthorization: 'bind-to-current-intent-and-exact-proposal',
    };
    expect(validateTemporalAuthority(valid)).toEqual([]);

    expect(validateTemporalAuthority({ ...valid, futureYou: 'authoritative' })).toEqual([
      expect.objectContaining({
        classification: 'temporal-authority-mismatch',
        key: 'futureYou',
        expected: 'advisory-only',
        actual: 'authoritative',
      }),
    ]);
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
