import { describe, expect, test } from 'vitest';
import { normalizeCustomPrompts } from './prompt-state.js';

describe('custom prompt shape membrane', () => {
  test('repairs usable imported prompt shapes and drops entries without prompt text', () => {
    const result = normalizeCustomPrompts([
      {
        id: 'custom-shape-repair',
        title: 'Shape repair',
        platforms: 'chatgpt',
        versions: { ChatGPT: 'Safe body', claude: 42 },
      },
      {
        id: 'custom-no-body',
        title: 'No body',
        platforms: ['chatgpt'],
        versions: { chatgpt: 42 },
      },
    ]);

    expect(result.changed).toBe(true);
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]).toMatchObject({
      id: 'custom-shape-repair',
      title: 'Shape repair',
      cat: 'custom',
      platforms: ['chatgpt'],
      versions: { chatgpt: 'Safe body' },
    });
  });

  test('keeps custom identity separate from reserved and duplicate prompt ids', () => {
    const result = normalizeCustomPrompts([
      { id: '1', title: 'Reserved collision', platforms: ['chatgpt'], versions: { chatgpt: 'A' } },
      { id: 'dup', title: 'First duplicate', platforms: ['chatgpt'], versions: { chatgpt: 'B' } },
      { id: 'dup', title: 'Second duplicate', platforms: ['chatgpt'], versions: { chatgpt: 'C' } },
    ], { reservedIds: [1] });

    const ids = result.prompts.map(prompt => prompt.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).not.toBe('1');
    expect(ids[0]).toMatch(/^custom-/);
    expect(ids[1]).toMatch(/^custom-/);
    expect(ids[2]).toMatch(/^custom-/);
  });

  test('preserves valid prompt body formatting while normalizing metadata', () => {
    const result = normalizeCustomPrompts([{
      id: 'custom-valid',
      title: 'Valid prompt',
      sub: '',
      cat: 'custom',
      platforms: ['chatgpt'],
      versions: { chatgpt: 'line 1\n\nline 2' },
      emoji: '✨',
    }]);

    expect(result.prompts[0].versions.chatgpt).toBe('line 1\n\nline 2');
  });
});
