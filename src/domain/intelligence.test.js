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
const CANONICAL_CUSTOM = {
  id: 'legacy',
  title: 'Legacy prompt',
  sub: '',
  cat: 'research',
  platforms: ['chatgpt'],
  versions: { chatgpt: 'Use supplied evidence only.' },
  emoji: '✨',
  notes: '',
  repos: [],
};
const VALID_GOAL = {
  goal: 'Recover founder intelligence',
  project: 'Chief AI',
  priority: 'now',
  definitionOfDone: 'A clean browser can restore the exported state.',
  evidence: ['Exact snapshot parses.'],
  constraints: ['No silent data loss.'],
  strategicLenses: ['portability'],
  capabilities: ['company-brain'],
  proofRequirements: ['Playwright clean-state restore'],
  rollback: 'Restore the previous local snapshot.',
  nextGate: 'Verify clean-state restore.',
  createdAt: NOW.toISOString(),
};

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

  it('round-trips the portable snapshot format without changing founder-owned state', () => {
    const asset = createIntelligenceAsset({
      title: 'Founder voice',
      kind: 'brand-voice',
      content: 'Direct, warm, skeptical, evidence-first.',
    }, NOW);
    const snapshot = createPortableSnapshot({
      assets: [asset],
      customPrompts: [CANONICAL_CUSTOM],
      stars: [1, 'legacy'],
      goals: [VALID_GOAL],
      exportedAt: NOW.toISOString(),
    });

    const parsed = parsePortableSnapshot(snapshot, NOW);
    expect(parsed.assets).toEqual([asset]);
    expect(parsed.customPrompts).toEqual([CANONICAL_CUSTOM]);
    expect(parsed.stars).toEqual([1, 'legacy']);
    expect(parsed.goals).toEqual([VALID_GOAL]);
  });

  it('fails closed instead of silently dropping invalid intelligence during export', () => {
    const valid = createIntelligenceAsset({
      title: 'Recovery-critical workflow',
      kind: 'workflow',
      content: 'This asset must never disappear from a successful-looking export.',
    }, NOW);
    const invalid = { ...valid, id: '' };

    expect(() => createPortableSnapshot({ assets: [valid, invalid] }))
      .toThrow('Portable export blocked: intelligence asset 2 is invalid (Missing id)');
  });

  it('fails closed instead of normalizing lossy compatibility data during export', () => {
    expect(() => createPortableSnapshot({
      customPrompts: [{ ...CANONICAL_CUSTOM, versions: { chatgpt: 'Use supplied evidence only.', 'bad platform': 'must not vanish' } }],
    })).toThrow('Portable export blocked: custom prompt state contains invalid or lossy data');

    expect(() => createPortableSnapshot({ stars: [1, { private: 'must not vanish' }] }))
      .toThrow('Portable export blocked: star state contains invalid or lossy data');
  });

  it('fails closed when founder goals cannot be restored as usable goals', () => {
    expect(() => createPortableSnapshot({
      goals: [{ ...VALID_GOAL, proofRequirements: [] }],
    })).toThrow('Portable export blocked: founder goal 1 is invalid');

    expect(() => createPortableSnapshot({
      goals: [{ ...VALID_GOAL, evidence: 'not-an-array' }],
    })).toThrow('evidence must be an array');
  });

  it('ignores object key order while rejecting lossy current state', () => {
    const reordered = {
      repos: [],
      notes: '',
      emoji: '✨',
      versions: { chatgpt: 'Use supplied evidence only.' },
      platforms: ['chatgpt'],
      cat: 'research',
      sub: '',
      title: 'Legacy prompt',
      id: 'legacy',
    };
    expect(() => createPortableSnapshot({ customPrompts: [reordered] })).not.toThrow();
  });

  it('rejects lossy current-format snapshots instead of cleaning them during import', () => {
    expect(() => parsePortableSnapshot({
      format: 'founder-intelligence-snapshot',
      schemaVersion: 1,
      assets: [],
      compatibility: {
        customPrompts: [null, CANONICAL_CUSTOM],
        stars: [1, { injected: true }],
      },
      goals: [VALID_GOAL],
    }, NOW)).toThrow('Import failed: custom prompt state contains invalid or lossy data');
  });

  it('keeps old current-format snapshots that predate goal portability non-destructive', () => {
    const parsed = parsePortableSnapshot({
      format: 'founder-intelligence-snapshot',
      schemaVersion: 1,
      assets: [],
      compatibility: { customPrompts: [], stars: [] },
    }, NOW);

    expect(parsed.goals).toBeNull();
  });

  it('normalizes imported prompt object shape without treating prompt prose as markup', () => {
    const promptBody = '  <script>this is prompt text, not executable UI</script>\n';
    const prompt = normalizeCustomPrompt({
      id: ' imported-1 ',
      title: '<img src=x onerror="globalThis.compromised=true">',
      sub: '<svg onload="globalThis.compromised=true"></svg>',
      cat: ' Research ',
      platforms: ['ChatGPT', '__proto__', 'BAD PLATFORM'],
      versions: {
        chatgpt: promptBody,
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
      versions: { chatgpt: promptBody },
      emoji: '✨',
      notes: '',
      repos: ['chief-ai-machine'],
    });
    expect(prompt.versions.chatgpt).toBe(promptBody);
    expect(prompt).not.toHaveProperty('dangerous');
  });

  it('rejects imported custom prompts without a usable provider version', () => {
    expect(normalizeCustomPrompt({
      title: 'Versionless prompt',
      platforms: ['chatgpt'],
      versions: {},
    })).toBeNull();

    expect(normalizeCustomPrompt({
      title: 'Whitespace-only prompt',
      versions: { chatgpt: '   \n\t ' },
    })).toBeNull();
  });

  it('sanitizes the original legacy export format for backward compatibility only', () => {
    const parsed = parsePortableSnapshot({
      custom: [null, {
        id: 'custom-2',
        title: 'Old prompt',
        platforms: ['claude'],
        versions: { claude: 'Do the work.' },
      }],
      stars: [4, { injected: true }],
    }, NOW);

    expect(parsed.assets).toHaveLength(1);
    expect(parsed.assets[0].source).toBe('legacy-chief-prompt');
    expect(parsed.customPrompts[0].title).toBe('Old prompt');
    expect(parsed.stars).toEqual([4]);
    expect(parsed.goals).toBeNull();
  });
});
