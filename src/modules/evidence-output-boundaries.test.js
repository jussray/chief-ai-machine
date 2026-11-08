import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const builder = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
const freestyle = readFileSync(new URL('./freestyle.js', import.meta.url), 'utf8');

describe('evidence-first runtime output boundaries', () => {
  it('normalizes Builder output before render, copy, and save', () => {
    expect(builder).toContain("import { applyEvidenceFirstContract } from '../domain/evidence-first-prompt.js';");
    expect(builder).toContain('out.textContent = applyEvidenceFirstContract(interpolated);');
    expect(builder).toContain('copyText(text);');
    expect(builder).toContain('versions: { [platformEl?.value || \'chatgpt\']: text }');
    expect(builder).not.toMatch(/out\.textContent\s*=\s*source/);
  });

  it('normalizes Freestyle render, tab, copy, and save paths', () => {
    expect(freestyle).toContain("import { applyEvidenceFirstContract } from '../domain/evidence-first-prompt.js';");
    expect(freestyle).toContain('fsBody.textContent = promptText(base, p);');
    expect(freestyle).toContain('fsBody.textContent = promptText(base, currentPlatform);');
    expect(freestyle).toContain('copyText(promptText(currentResult, currentPlatform));');
    expect(freestyle).toContain('versions: normalizedVersions(currentResult)');
    expect(freestyle).not.toContain('copyText(currentResult.versions[currentPlatform])');
    expect(freestyle).not.toContain("fsBody.textContent = base.versions[currentPlatform] || ''");
  });
});
