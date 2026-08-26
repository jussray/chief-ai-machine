import { describe, expect, it } from 'vitest';
import {
  createIntelligenceAsset,
  createPortableSnapshot,
  migrateLegacyPrompt,
  normalizeCustomPrompt,
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

  it('round-trips the portable snapshot format with bounded compatibility data', () => {
    const asset = createIntelligenceAsset({
      title: 'Founder voice',
      kind: 'brand-voice',
      content: 'Direct, warm, skeptical, evidence-first.',
    }, NOW);
    const snapshot = createPortableSnapshot({
      assets: [asset],
      customPrompts: [{
        id: 'legacy',
        title: 'Legacy prompt',
        cat: 'research',
        platforms: ['ChatGPT'],
        versions: { chatgpt: 'Use supplied evidence only.' },
      }],
      stars: [1, 2],
      exportedAt: NOW.toISOString(),
    });

    const parsed = parsePortableSnapshot(snapshot, NOW);
    expect(parsed.assets).toEqual([asset]);
    expect(parsed.customPrompts).toEqual([{
      id: 'legacy',
      title: 'Legacy prompt',
      sub: '',
      cat: 'research',
      platforms: ['chatgpt'],
      versions: { chatgpt: 'Use supplied evidence only.' },
      emoji: '✨',
      notes: '',
      repos: [],
    }]);
    expect(parsed.stars).toEqual([1, 2]);
  });

  it('normalizes imported prompt object shape without treating prompt prose as markup', () => {
    const prompt = normalizeCustomPrompt({
      id: ' imported-1 ',
      title: '<img src=x onerror="globalThis.compromised=true">',
      sub: '<svg onload="globalThis.compromised=true"></svg>',
      cat: ' Research ',
      platforms: ['ChatGPT', '__proto__', 'BAD PLATFORM'],
      versions: {
        chatgpt: '<script>this is prompt text, not executable UI</script>',
        '__proto__': 'drop me',
        'bad platform': 'drop me too',
      },
      repos: [' chief-ai-machine ', '', { nope: true }],
      dangerous: { execute: true },
    }, 3);

    expect(prompt).toEqual({
      id: 'imported-1',
      title: '<img src=x onerror="globalThis.compromised=true">',
      sub: '<svg onload="globalThis.compromised=true"></svg>',
      cat: 'research',
      platforms: ['chatgpt'],
      versions: { chatgpt: '<script>this is prompt text, not executable UI</script>' },
      emoji: '✨',
      notes: '',
      repos: ['chief-ai-machine'],
    });
    expect(prompt).not.toHaveProperty('dangerous');
  });

  it('bounds compatibility arrays and drops non-primitive star references', () => {
    const parsed = parsePortableSnapshot({
      format: 'founder-intelligence-snapshot',
      schemaVersion: 1,
      assets: [],
      compatibility: {
        customPrompts: [null, { title: 'Safe import', platforms: ['claude'], versions: { claude: 'Summarize.' } }],
        stars: [1, 'custom-1', { injected: true }, null, 1.5],
      },
    }, NOW);

    expect(parsed.customPrompts).toHaveLength(1);
    expect(parsed.customPrompts[0].title).toBe('Safe import');
    expect(parsed.stars).toEqual([1, 'custom-1']);
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
    expect(parsed.customPrompts[0].title).toBe('Old prompt');
    expect(parsed.stars).toEqual([4]);
  });
});