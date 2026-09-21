import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

const workflow = await readFile('.github/workflows/freestyle-save-playwright.yml', 'utf8');

const COMPANY_BRAIN_PATHS = [
  'src/main\\.js$',
  'src/modules/(freestyle|custom|brain|library|modal|star-storage)\\.js$',
  'src/domain/(evidence-first-prompt|intelligence|intelligence-history|goal-plan)\\.js$',
  'company-brain-portability',
  'company-brain-app-prompt-export',
  'company-brain-version-history',
];

describe('Company Brain browser-proof scope', () => {
  it('classifies the complete current portability dependency surface as browser-affecting', () => {
    for (const path of COMPANY_BRAIN_PATHS) expect(workflow).toContain(path);
  });

  it('keeps candidate browser evidence distinct from the ruleset-required trusted context', () => {
    expect(workflow).toContain('pull_request_target:');
    expect(workflow).toMatch(/\n {2}pull_request:\n/);
    expect(workflow).toContain("github.event_name == 'pull_request_target' && 'Verify Freestyle and Goalfix in Chromium'");
    expect(workflow).toContain('Verify Freestyle and Goalfix in Chromium (candidate evidence only)');
    expect(workflow).toContain('REQUIRED_CHECK_NAME: Verify Freestyle, Goalfix, and PromptOS in Chromium');
    expect(workflow).toContain('Legacy required-context name retained for active repository ruleset compatibility.');
    expect(workflow).toContain('permissions:\n  contents: read');
    expect(workflow).not.toContain('secrets.');
  });
});
