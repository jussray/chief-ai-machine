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
      repos: [],
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

  test('canonicalizes repo scope and drops arbitrary imported fields', () => {
    const result = normalizeCustomPrompts([{
      id: 'custom-hostile-shape',
      title: 'Hostile shape',
      platforms: ['chatgpt'],
      versions: { chatgpt: 'Safe body' },
      repos: { includes: 'not-an-array' },
      authority: { granted: true },
      __proto_pollution_probe: 'inert',
    }]);

    expect(result.changed).toBe(true);
    expect(result.prompts).toEqual([{
      id: 'custom-hostile-shape',
      title: 'Hostile shape',
      sub: '',
      cat: 'custom',
      notes: '',
      emoji: '✨',
      platforms: ['chatgpt'],
      versions: { chatgpt: 'Safe body' },
      repos: [],
    }]);
    expect(result.prompts[0]).not.toHaveProperty('authority');
    expect(result.prompts[0]).not.toHaveProperty('__proto_pollution_probe');
  });

  test('deduplicates and normalizes valid repo scope', () => {
    const result = normalizeCustomPrompts([{
      id: 'custom-repo-scope',
      title: 'Repo scoped',
      platforms: ['chatgpt'],
      versions: { chatgpt: 'Safe body' },
      repos: [' Bip ', 'bip', 'THINK-TANK', 42],
    }]);

    expect(result.changed).toBe(true);
    expect(result.prompts[0].repos).toEqual(['bip', 'think-tank']);
  });
});
