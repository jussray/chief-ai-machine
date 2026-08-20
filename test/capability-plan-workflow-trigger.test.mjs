import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKFLOW = '.github/workflows/chief-capability-plan-playwright.yml';

describe('Chief capability-plan runtime proof trigger boundary', () => {
  it('does not route governance-only operational authority changes into runtime Playwright', () => {
    const workflow = fs.readFileSync(WORKFLOW, 'utf8');

    expect(workflow).not.toContain('"config/operational-authority.json"');
    expect(workflow).toContain('"worker/chief-capability-plan.js"');
    expect(workflow).toContain('"e2e/chief-capability-plan.pw.mjs"');
    expect(workflow).toContain('".github/workflows/chief-capability-plan-playwright.yml"');
  });
});
