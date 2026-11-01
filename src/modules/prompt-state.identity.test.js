import { describe, expect, test } from 'vitest';
import { normalizeCustomPrompts, remapStarReferences, migrateLegacyCustomStarIds } from './prompt-state.js';

describe('custom prompt identity migration', () => {
  test('remaps a custom id that collides with a reserved public prompt without touching the public numeric star', () => {
    const normalized = normalizeCustomPrompts([
      {
        id: '1',
        title: 'Imported collision probe',
        platforms: ['chatgpt'],
        versions: { chatgpt: 'Safe prompt body' },
      },
      {
        id: 'portable-prompt-alpha',
        title: 'Portable identity',
        platforms: ['chatgpt'],
        versions: { chatgpt: 'Portable body' },
      },
    ], { reservedIds: [1, 'goalfix-v1-verified-loop'] });

    expect(normalized.prompts[0].id).toMatch(/^custom-/);
    expect(normalized.prompts[1].id).toBe('portable-prompt-alpha');
    expect(normalized.idRemap).toEqual([
      { from: '1', to: normalized.prompts[0].id },
    ]);

    const migrated = remapStarReferences(
      ['1', 1, 'portable-prompt-alpha'],
      normalized.idRemap,
      normalized.ambiguousIds,
    );

    expect(migrated.changed).toBe(true);
    expect(migrated.stars).toEqual([
      normalized.prompts[0].id,
      1,
      'portable-prompt-alpha',
    ]);
  });

  test('drops ambiguous string star references when duplicate imported ids are repaired', () => {
    const normalized = normalizeCustomPrompts([
      {
        id: 'portable-duplicate',
        title: 'First',
        platforms: ['chatgpt'],
        versions: { chatgpt: 'A' },
      },
      {
        id: 'portable-duplicate',
        title: 'Second',
        platforms: ['chatgpt'],
        versions: { chatgpt: 'B' },
      },
    ]);

    expect(normalized.ambiguousIds).toEqual(['portable-duplicate']);
    expect(normalized.prompts[0].id).toBe('portable-duplicate');
    expect(normalized.prompts[1].id).toMatch(/^custom-/);

    const migrated = remapStarReferences(
      ['portable-duplicate'],
      normalized.idRemap,
      normalized.ambiguousIds,
    );

    expect(migrated).toEqual({ stars: [], changed: true });
  });
  test('does not reinterpret a portable c0 ID as legacy positional star', () => {
    const custom = [
      { id: 'alpha' },
      { id: 'c0' },
    ];
    const first = migrateLegacyCustomStarIds(custom, ['c0']);
    const second = migrateLegacyCustomStarIds(custom, first.stars);
    expect(first).toEqual({ stars: ['c0'], changed: false });
    expect(second).toEqual({ stars: ['c0'], changed: false });
  });

  test('migrates true old positional stars only when they are not current IDs', () => {
    const custom = [{ id: 'alpha' }, { id: 'beta' }];
    expect(migrateLegacyCustomStarIds(custom, ['c0', 'c1']))
      .toEqual({ stars: ['alpha', 'beta'], changed: true });
  });

});
