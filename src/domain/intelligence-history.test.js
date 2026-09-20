import { describe, expect, it } from 'vitest';
import { createIntelligenceAsset } from './intelligence.js';
import {
  createPortableSnapshot,
  parsePortableSnapshot,
  upsertIntelligenceAsset,
  validateIntelligenceAsset,
} from './intelligence-history.js';

const T0 = new Date('2026-09-20T06:00:00.000Z');
const T1 = new Date('2026-09-20T06:01:00.000Z');
const T2 = new Date('2026-09-20T06:02:00.000Z');

function assetAt(content, now, input = {}) {
  return createIntelligenceAsset({
    id: 'asset-versioned',
    title: 'Versioned founder decision',
    kind: 'decision',
    status: 'approved',
    content,
    tags: ['history'],
    ...input,
  }, now);
}

describe('Company Brain immutable version history', () => {
  it('retains each prior version while keeping one current asset record', () => {
    const v1 = assetAt('Version one decision.', T0);
    let assets = upsertIntelligenceAsset([], v1);
    expect(assets).toHaveLength(1);
    expect(assets[0].version).toBe(1);
    expect(assets[0].history).toEqual([]);
    expect(assets[0].historyComplete).toBe(true);

    assets = upsertIntelligenceAsset(assets, assetAt('Version two decision.', T1));
    assets = upsertIntelligenceAsset(assets, assetAt('Version three decision.', T2));

    expect(assets).toHaveLength(1);
    expect(assets[0].version).toBe(3);
    expect(assets[0].content).toBe('Version three decision.');
    expect(assets[0].historyComplete).toBe(true);
    expect(assets[0].history.map((entry) => [entry.version, entry.content])).toEqual([
      [1, 'Version one decision.'],
      [2, 'Version two decision.'],
    ]);
    expect(assets[0].history.every((entry) => !Object.hasOwn(entry, 'history'))).toBe(true);
    expect(validateIntelligenceAsset(assets[0])).toEqual({ valid: true, errors: [] });
  });

  it('marks pre-existing multi-version assets incomplete instead of inventing missing history', () => {
    const legacyV2 = { ...assetAt('Only version two survived.', T0), version: 2 };
    const updated = upsertIntelligenceAsset([legacyV2], assetAt('Version three after migration.', T1))[0];

    expect(updated.version).toBe(3);
    expect(updated.historyComplete).toBe(false);
    expect(updated.history).toHaveLength(1);
    expect(updated.history[0].version).toBe(2);
    expect(updated.history[0].content).toBe('Only version two survived.');
    expect(validateIntelligenceAsset(updated).valid).toBe(true);
  });

  it('refuses update payloads that try to rewrite managed history', () => {
    const v1 = upsertIntelligenceAsset([], assetAt('Original.', T0))[0];
    expect(() => upsertIntelligenceAsset([v1], {
      ...assetAt('Rewrite attempt.', T1),
      history: [],
      historyComplete: true,
    })).toThrow('Version history is managed by Company Brain');
  });

  it('round-trips retained history through the portable snapshot', () => {
    let assets = upsertIntelligenceAsset([], assetAt('Portable v1.', T0));
    assets = upsertIntelligenceAsset(assets, assetAt('Portable v2.', T1));

    const snapshot = createPortableSnapshot({ assets });
    const parsed = parsePortableSnapshot(snapshot, T2);

    expect(parsed.assets).toEqual(assets);
    expect(parsed.assets[0].history[0].content).toBe('Portable v1.');
  });

  it('fails closed on tampered or falsely complete history', () => {
    let assets = upsertIntelligenceAsset([], assetAt('Safe v1.', T0));
    assets = upsertIntelligenceAsset(assets, assetAt('Safe v2.', T1));

    const wrongId = structuredClone(assets[0]);
    wrongId.history[0].id = 'different-asset';
    expect(() => createPortableSnapshot({ assets: [wrongId] }))
      .toThrow('invalid version history');

    const missingVersion = structuredClone(assets[0]);
    missingVersion.history = [];
    missingVersion.historyComplete = true;
    const portable = createPortableSnapshot({ assets });
    portable.assets = [missingVersion];
    expect(() => parsePortableSnapshot(portable, T2))
      .toThrow('invalid version history');
  });
});
