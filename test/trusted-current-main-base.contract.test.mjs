import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new globalThis.URL(`../${path}`, import.meta.url), 'utf8');

const founderGoals = read('.github/workflows/founder-goals-playwright.yml');
const freestyle = read('.github/workflows/freestyle-save-playwright.yml');
const materializer = read('.github/workflows/governance-required-check-materializer.yml');

describe('trusted current-main diff base contract', () => {
  it('binds pull_request_target evaluators to the trusted current-main workflow SHA', () => {
    expect(founderGoals).toContain('BASE_SHA: ${{ github.sha }}');
    expect(founderGoals).not.toContain('BASE_SHA: ${{ github.event.pull_request.base.sha || github.sha }}');

    expect(materializer).toContain('BASE_SHA: ${{ github.sha }}');
    expect(materializer).not.toContain('BASE_SHA: ${{ github.event.pull_request.base.sha }}');

    expect(freestyle).toContain("BASE_SHA: ${{ github.event_name == 'pull_request_target' && github.sha || github.event.pull_request.base.sha || github.sha }}");
    expect(freestyle).not.toContain('BASE_SHA: ${{ github.event.pull_request.base.sha || github.sha }}');
  });

  it('keeps the trusted evaluator equality guard on all affected workflows', () => {
    for (const workflow of [founderGoals, freestyle, materializer]) {
      expect(workflow).toContain('TRUSTED_EVALUATOR_SHA: ${{ github.sha }}');
      expect(workflow).toContain('test "$TRUSTED_EVALUATOR_SHA" = "$BASE_SHA"');
    }
  });
});
