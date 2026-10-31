import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const forbiddenImplementationPaths = [
  'src/promptos',
  'src/modules/promptos-ui.js',
  'styles/promptos.css',
  'scripts/generateCatalog.mjs',
  'e2e/promptos-catalog.pw.mjs',
];

describe('Chief / PromptOS repository boundary', () => {
  it('does not embed PromptOS product implementation', () => {
    for (const path of forbiddenImplementationPaths) expect(existsSync(path), `${path} belongs in jussray/promptos`).toBe(false);
  });

  it('does not mount or generate PromptOS from Chief', () => {
    expect(readFileSync('src/main.js', 'utf8')).not.toContain('mountPromptOS');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts?.['generate:promptos']).toBeUndefined();
    expect(readFileSync('e2e/playwright.freestyle.config.mjs', 'utf8')).not.toContain('promptos-catalog');
  });

  it('retains only the versioned PromptOS interop contract needed by Chief reasoning', () => {
    const envelope = readFileSync('src/domain/founder-intent-envelope.js', 'utf8');
    expect(envelope).toContain("PROMPTOS_MISSION_CONTRACT = 'founder-os-mission-v1'");
  });
});
