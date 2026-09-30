import { describe, expect, it } from 'vitest';
import { validateWorkflow, validateSkillAuthority, AUTHORITY_MARKERS } from '../scripts/verify-pr-credential-membrane.mjs';

const VALID_WORKFLOW = `name: Test Playwright

on:
  pull_request_target:
    branches: [main]
  workflow_dispatch:
    inputs:
      expected_head_sha:
        required: true

env:
  TRUSTED_EVALUATOR_SHA: \${{ github.sha }}

jobs:
  verify:
    steps:
      - name: Verify trusted event boundary
        run: echo ok
      - uses: actions/checkout@abc123
        with:
          persist-credentials: false
`;

const VALID_SKILL = AUTHORITY_MARKERS.join('\n\n');

describe('credential membrane workflow validation', () => {
  it('passes for a valid trusted-evaluator workflow', () => {
    expect(validateWorkflow('test.yml', VALID_WORKFLOW)).toEqual([]);
  });

  it('detects missing pull_request_target trigger', () => {
    const bad = VALID_WORKFLOW.replace('pull_request_target:', 'pull_request:');
    const failures = validateWorkflow('test.yml', bad);
    expect(failures).toContainEqual(expect.stringContaining('pull_request_target trusted-evaluator trigger missing'));
  });

  it('detects missing TRUSTED_EVALUATOR_SHA binding', () => {
    const bad = VALID_WORKFLOW.replace('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}', 'EVALUATOR: other');
    const failures = validateWorkflow('test.yml', bad);
    expect(failures).toContainEqual(expect.stringContaining('trusted evaluator SHA must bind to the main-branch merge commit'));
  });

  it('detects missing trusted event boundary step', () => {
    const bad = VALID_WORKFLOW.replace('Verify trusted event boundary', 'Check something else');
    const failures = validateWorkflow('test.yml', bad);
    expect(failures).toContainEqual(expect.stringContaining('trusted event boundary verification step missing'));
  });

  it('detects persisted credentials', () => {
    const bad = VALID_WORKFLOW.replace('persist-credentials: false', 'persist-credentials: true');
    const failures = validateWorkflow('test.yml', bad);
    expect(failures).toContainEqual(expect.stringContaining('checkout must not persist credentials'));
  });

  it('detects Cloudflare Access secret references', () => {
    const bad = VALID_WORKFLOW + '\n  CLOUDFLARE_ACCESS_CLIENT_ID: ${{ secrets.CLOUDFLARE_ACCESS_CLIENT_ID }}';
    const failures = validateWorkflow('test.yml', bad);
    expect(failures).toContainEqual(expect.stringContaining('must not reference Cloudflare Access secrets'));
  });

  it('detects proofmode-access-admin environment entry', () => {
    const bad = VALID_WORKFLOW + '\n    environment: proofmode-access-admin';
    const failures = validateWorkflow('test.yml', bad);
    expect(failures).toContainEqual(expect.stringContaining('must not enter proofmode-access-admin'));
  });

  it('detects missing jobs block', () => {
    const bad = VALID_WORKFLOW.replace('\njobs:\n', '\nsteps:\n');
    const failures = validateWorkflow('test.yml', bad);
    expect(failures).toContainEqual(expect.stringContaining('jobs block missing'));
  });
});

describe('credential membrane skill authority validation', () => {
  it('passes when all authority markers are present', () => {
    expect(validateSkillAuthority(VALID_SKILL)).toEqual([]);
  });

  it('detects each missing marker individually', () => {
    for (const marker of AUTHORITY_MARKERS) {
      const partial = AUTHORITY_MARKERS.filter((m) => m !== marker).join('\n');
      const failures = validateSkillAuthority(partial);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toContain(marker);
    }
  });

  it('reports all missing markers at once', () => {
    const failures = validateSkillAuthority('');
    expect(failures).toHaveLength(AUTHORITY_MARKERS.length);
  });
});

describe('credential membrane integration with real files', () => {
  it('passes against the actual repository workflows and skill', async () => {
    const { readFile } = await import('node:fs/promises');
    const root = new globalThis.URL('../', import.meta.url);

    for (const path of [
      '.github/workflows/proofmode-mcp-playwright.yml',
      '.github/workflows/chief-capability-plan-playwright.yml',
    ]) {
      const text = await readFile(new globalThis.URL(path, root), 'utf8');
      expect(validateWorkflow(path, text)).toEqual([]);
    }

    const skill = await readFile(new globalThis.URL('.claude/skills/juss-chief-ai/SKILL.md', root), 'utf8');
    expect(validateSkillAuthority(skill)).toEqual([]);
  });
});
