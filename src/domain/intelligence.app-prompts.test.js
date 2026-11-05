import { describe, expect, it } from 'vitest';
import { createPortableSnapshot, parsePortableSnapshot } from './intelligence.js';

const BUILDER_PROMPT = {
  id: 'b-1720000000000',
  title: 'Builder: Goalfix v1',
  sub: 'Saved from Builder',
  cat: 'custom',
  platforms: ['chatgpt'],
  versions: { chatgpt: 'Use supplied evidence and return one verified move.' },
};

const FREESTYLE_PROMPT = {
  id: 'fs-1720000000001',
  title: 'Friend Mode v1',
  sub: 'Mirror → intent → tiny move',
  cat: 'persona',
  platforms: ['chatgpt'],
  versions: {
    chatgpt: 'Turn this raw situation into one useful move.',
    claude: 'Convert this situation into one bounded move.',
  },
  emoji: '🤝',
  notes: '',
  repos: ['bip'],
};

const CANONICAL_BUILDER_PROMPT = {
  ...BUILDER_PROMPT,
  emoji: '✨',
  notes: '',
  repos: [],
};

const CANONICAL_FREESTYLE_PROMPT = {
  ...FREESTYLE_PROMPT,
  platforms: ['chatgpt', 'claude'],
};

describe('company brain compatibility for app-created prompts', () => {
  it('exports Builder and Freestyle saves by applying only non-lossy canonical defaults', () => {
    const snapshot = createPortableSnapshot({
      customPrompts: [BUILDER_PROMPT, FREESTYLE_PROMPT],
      exportedAt: '2026-09-20T05:55:00.000Z',
    });

    expect(snapshot.compatibility.customPrompts).toEqual([
      CANONICAL_BUILDER_PROMPT,
      CANONICAL_FREESTYLE_PROMPT,
    ]);
    expect(snapshot.compatibility.customPrompts[1].versions).toEqual(FREESTYLE_PROMPT.versions);
  });

  it('canonicalizes the same non-lossy app shapes when restoring a current-format snapshot', () => {
    const parsed = parsePortableSnapshot({
      product: 'chief-ai',
      format: 'founder-intelligence-snapshot',
      schemaVersion: 1,
      exportedAt: '2026-09-20T05:55:00.000Z',
      assets: [],
      compatibility: {
        customPrompts: [BUILDER_PROMPT, FREESTYLE_PROMPT],
        stars: [BUILDER_PROMPT.id],
      },
      goals: [],
    });

    expect(parsed.customPrompts).toEqual([
      CANONICAL_BUILDER_PROMPT,
      CANONICAL_FREESTYLE_PROMPT,
    ]);
    expect(parsed.stars).toEqual([BUILDER_PROMPT.id]);
  });

  it('still fails closed when canonicalization would drop or rewrite meaningful prompt data', () => {
    expect(() => createPortableSnapshot({
      customPrompts: [{ ...BUILDER_PROMPT, dangerous: { execute: true } }],
    })).toThrow('Portable export blocked: custom prompt state contains invalid or lossy data');

    expect(() => createPortableSnapshot({
      customPrompts: [{
        ...BUILDER_PROMPT,
        versions: {
          chatgpt: BUILDER_PROMPT.versions.chatgpt,
          'bad platform': 'This body must never silently disappear.',
        },
      }],
    })).toThrow('Portable export blocked: custom prompt state contains invalid or lossy data');

    expect(() => createPortableSnapshot({
      customPrompts: [{ ...BUILDER_PROMPT, repos: [' bip '] }],
    })).toThrow('Portable export blocked: custom prompt state contains invalid or lossy data');
  });
});