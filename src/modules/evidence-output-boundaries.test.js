import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasEvidenceFirstContract, renderPromptVariant } from '../domain/evidence-first-prompt.js';

const builder = readFileSync(new URL('./builder.js', import.meta.url), 'utf8');
const freestyle = readFileSync(new URL('./freestyle.js', import.meta.url), 'utf8');

describe('evidence-first runtime output boundaries', () => {
  it('normalizes Builder output through the canonical prompt renderer before render, copy, and save', () => {
    expect(builder).toContain("import { renderPromptVariant } from '../domain/evidence-first-prompt.js';");
    expect(builder).toContain('out.textContent = renderPromptVariant(selected, platform');
    expect(builder).toContain('copyText(text)');
    expect(builder).toContain("writeCustomPrompts([...current.prompts, next])");
  });

  it('normalizes Freestyle render, tab, copy, and save paths through the canonical prompt renderer', () => {
    expect(freestyle).toContain("import { renderPromptVariant } from '../domain/evidence-first-prompt.js';");
    expect(freestyle).toContain('return renderPromptVariant(currentResult, currentPlatform);');
    expect(freestyle).toContain('versions: normalizePromptVersionsForSave(currentResult)');
    expect(freestyle).not.toContain('copyText(currentResult.versions[currentPlatform])');
  });

  it('the canonical renderer always applies the evidence-first floor', () => {
    const rendered = renderPromptVariant({ versions: { chatgpt: 'Do the task.' } }, 'chatgpt');
    expect(hasEvidenceFirstContract(rendered)).toBe(true);
  });
});
