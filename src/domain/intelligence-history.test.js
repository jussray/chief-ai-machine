import { describe, expect, it } from 'vitest';
import { createIntelligenceAsset } from './intelligence.js';
import {
  createPortableSnapshot,
  parsePortableSnapshot,
  upsertIntelligenceAsset,
  validateIntelligenceAsset,
} from './intelligence-history.js';

const NOW = new Date('2026-10-23T12:00:00.000Z');
const original = createIntelligenceAsset({
  id: 'chief-asset-test',
  title: 'Decision framework',
  content: 'Original founder decision',
  kind: 'decision',
}, NOW);

describe('Company Brain version-history portability', () => {
  it('preserves both revisions across a portable export/import round trip', () => {
    const one = upsertIntelligenceAsset([], original);
    expect(one[0].historyComplete).toBe(true);
    expect(one[0].history).toEqual([]);

    const update = createIntelligenceAsset({
      ...original,
      content: 'Revised founder decision',
    }, new Date('2026-10-23T13:00:00.000Z'));
    const two = upsertIntelligenceAsset(one, update);
    expect(two[0].version).toBe(2);
    expect(two[0].historyComplete).toBe(true);
    expect(two[0].history).toHaveLength(1);
    expect(two[0].history[0].content).toBe(original.content);
    expect(two[0].history[0].version).toBe(1);
    expect(validateIntelligenceAsset(two[0]).valid).toBe(true);

    const exported = createPortableSnapshot({ assets: two });
    const restored = parsePortableSnapshot(exported);
    expect(restored.assets).toEqual(two);
  });

  it('marks prior revisions as incomplete when upgrading a legacy v2 asset', () => {
    const legacy = { ...original, version: 2 };
    const next = upsertIntelligenceAsset([legacy], { ...legacy, content: 'New content' });
    expect(next[0].version).toBe(3);
    expect(next[0].historyComplete).toBe(false);
    expect(next[0].history.map(entry => entry.version)).toEqual([2]);
  });

  it('refuses to silently export corrupt or tampered history', () => {
    const broken = {
      ...original,
      version: 2,
      history: [],
      historyComplete: true,
    };
    expect(validateIntelligenceAsset(broken).valid).toBe(false);
    expect(() => createPortableSnapshot({ assets: [broken] })).toThrow(/history/i);
    expect(() => parsePortableSnapshot({
      format: 'founder-intelligence-snapshot',
      schemaVersion: 1,
      assets: [broken],
      compatibility: { customPrompts: [], stars: [] },
    })).toThrow(/history/i);
  });

  it('preserves valid legacy one-version assets without fabricating history', () => {
    const restored = parsePortableSnapshot(createPortableSnapshot({ assets: [original] }));
    expect(restored.assets).toEqual([original]);
    const newRevision = upsertIntelligenceAsset(restored.assets, { ...original, content: 'Edited' });
    expect(newRevision[0].historyComplete).toBe(true);
    expect(newRevision[0].history[0].version).toBe(1);
  });
});
