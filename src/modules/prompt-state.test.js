import { describe, expect, test, vi } from 'vitest';
import { normalizeCustomPrompts, writeCustomPrompts, writeStars } from './prompt-state.js';
import { readLocalFirstOutbox } from './local-first.js';

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

  test('preserves safe portable ids while repairing reserved and duplicate ids', () => {
    const result = normalizeCustomPrompts([
      { id: '1', title: 'Reserved collision', platforms: ['chatgpt'], versions: { chatgpt: 'A' } },
      { id: 'portable-prompt-alpha', title: 'Portable identity', platforms: ['chatgpt'], versions: { chatgpt: 'B' } },
      { id: 'portable-prompt-alpha', title: 'Duplicate identity', platforms: ['chatgpt'], versions: { chatgpt: 'C' } },
    ], { reservedIds: [1] });

    const ids = result.prompts.map(prompt => prompt.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids[0]).not.toBe('1');
    expect(ids[0]).toMatch(/^custom-/);
    expect(ids[1]).toBe('portable-prompt-alpha');
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

describe('prompt mutations and local-first outbox', () => {
  test('all prompt and star replacements compact the queued snapshot', () => {
    const values = new Map();
    const storage = {
      getItem: key => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
    };
    vi.stubGlobal('localStorage', storage);
    try {
      const original = [{
        id: 'custom-offline-1',
        title: 'Offline prompt',
        platforms: ['chatgpt'],
        versions: { chatgpt: 'Saved locally' },
      }];
      writeCustomPrompts(original);
      writeStars(['custom-offline-1']);
      writeCustomPrompts([]);
      writeStars([]);

      expect(JSON.parse(storage.getItem('chief-custom'))).toEqual([]);
      expect(JSON.parse(storage.getItem('chief-stars'))).toEqual([]);
      const pending = readLocalFirstOutbox(storage);
      expect(pending).toHaveLength(2);
      expect(pending).toEqual([
        expect.objectContaining({ storageKey: 'chief-custom', scope: 'custom-prompts', payload: [] }),
        expect.objectContaining({ storageKey: 'chief-stars', scope: 'starred-prompts', payload: [] }),
      ]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
