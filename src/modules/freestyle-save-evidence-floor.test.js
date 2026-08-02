import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('./freestyle.js', import.meta.url), 'utf8');

describe('Freestyle saved prompt boundary', () => {
  it('stores normalized provider variants instead of raw prompt versions', () => {
    expect(source).toContain("import { renderPromptVariant } from '../domain/evidence-first-prompt.js';");
    expect(source).toContain('function normalizedVersions(prompt)');
    expect(source).toContain('renderPromptVariant(prompt, platform)');
    expect(source).toContain('versions: normalizedVersions(currentResult)');
    expect(source).not.toMatch(/custom\.push\(\{\s*\.\.\.currentResult,\s*id:\s*'fs-'/s);
  });
});
