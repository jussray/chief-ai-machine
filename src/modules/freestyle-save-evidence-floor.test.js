import { describe, expect, it } from 'vitest';
import { normalizePromptVersionsForSave } from './freestyle.js';

describe('Freestyle saved prompt boundary', () => {
  it('stores governed provider variants without mutating the source prompt', () => {
    const prompt = {
      platforms: ['chatgpt', 'claude'],
      versions: {
        claude: 'Review the supplied repository change.',
      },
    };
    const original = JSON.parse(JSON.stringify(prompt));

    const saved = normalizePromptVersionsForSave(prompt);

    expect(Object.keys(saved)).toEqual(['chatgpt', 'claude']);
    expect(saved.chatgpt).toContain('Review the supplied repository change.');
    expect(saved.chatgpt).toContain('EVIDENCE-FIRST FLOOR:');
    expect(saved.claude).toContain('EVIDENCE-FIRST FLOOR:');
    expect(saved.claude.match(/EVIDENCE-FIRST FLOOR:/g)).toHaveLength(1);
    expect(prompt).toEqual(original);
  });

  it('preserves version keys even when legacy prompt metadata omits platforms', () => {
    const saved = normalizePromptVersionsForSave({
      versions: {
        perplexity: 'Verify this claim against the supplied evidence.',
      },
    });

    expect(Object.keys(saved)).toEqual(['perplexity']);
    expect(saved.perplexity).toContain('Verify this claim against the supplied evidence.');
    expect(saved.perplexity).toContain('EVIDENCE-FIRST FLOOR:');
  });
});
