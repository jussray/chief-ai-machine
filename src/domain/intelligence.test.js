import { describe, expect, it } from 'vitest';
import {
  createIntelligenceAsset,
  createPortableSnapshot,
  migrateLegacyPrompt,
  parsePortableSnapshot,
  upsertIntelligenceAsset,
  validateIntelligenceAsset,
} from './intelligence.js';

const NOW = new Date('2026-07-14T12:00:00.000Z');

describe('founder intelligence assets', () => {
  it('creates a provider-neutral portable asset', () => {
    const asset = createIntelligenceAsset({
      title: 'Launch decision framework',
      kind: 'decision',
      content: 'Compare evidence, downside, reversibility, and owner approval.',
      tags: ['Launch', 'Decision', 'launch'],
    }, NOW);

    expect(asset.provider).toBe('provider-neutral');
    expect(asset.tags).toEqual(['launch', 'decision']);
    expect(asset.id).toContain('launch-decision-framework');
    expect(validateIntelligenceAsset(asset)).toEqual({ valid: true, errors: [] });
  });

  it('rejects incomplete assets', () => {
    expect(() => createIntelligenceAsset({ title: 'Missing body' }, NOW)).toThrow('Asset content is required');
  });

  it('versions an existing asset when it is updated', () => {
    const first = createIntelligenceAsset({
      id: 'asset-1',
      title: 'Sales workflow',
      kind: 'workflow',
      content: 'Research, qualify, draft, review.',
    }, NOW);
    const next = { ...first, content: 'Research, qualify, draft, review, measure.' };

    const assets = upsertIntelligenceAsset([first], next);
    expect(assets).toHaveLength(1);
    expect(assets[0].version).toBe(2);
    expect(assets[0].content).toContain('measure');
  });

  it('migrates a legacy custom prompt into an intelligence asset', () => {
    const asset = migrateLegacyPrompt({
      id: 'custom-1',
      title: 'Vendor audit',
      sub: 'Review a vendor without exposing private data',
      cat: 'research',
      platforms: ['chatgpt', 'claude'],
      versions: { chatgpt: 'Audit this vendor using supplied evidence only.' },
      repos: ['jbh'],
    }, NOW);

    expect(asset.id).toBe('legacy-custom-1');
    expect(asset.kind).toBe('prompt');
    expect(asset.projectId).toBe('jbh');
    expect(asset.provider).toBe('chatgpt');
  });

  it('round-trips the portable snapshot format', () => {
    const asset = createIntelligenceAsset({
      title: 'Founder voice',
      kind: 'brand-voice',
      content: 'Direct, warm, skeptical, evidence-first.',
    }, NOW);
    const snapshot = createPortableSnapshot({
      assets: [asset],
      customPrompts: [{ id: 'legacy' }],
      stars: [1, 2],
      exportedAt: NOW.toISOString(),
    });

    const parsed = parsePortableSnapshot(snapshot, NOW);
    expect(parsed.assets).toEqual([asset]);
    expect(parsed.customPrompts).toEqual([{ id: 'legacy' }]);
    expect(parsed.stars).toEqual([1, 2]);
  });

  it('accepts the original export format for backward compatibility', () => {
    const parsed = parsePortableSnapshot({
      custom: [{
        id: 'custom-2',
        title: 'Old prompt',
        platforms: ['claude'],
        versions: { claude: 'Do the work.' },
      }],
      stars: [4],
    }, NOW);

    expect(parsed.assets).toHaveLength(1);
    expect(parsed.assets[0].source).toBe('legacy-chief-prompt');
    expect(parsed.stars).toEqual([4]);
  });
});
