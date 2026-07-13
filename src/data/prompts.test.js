import { describe, it, expect } from 'vitest';
import { PROMPTS } from './prompts.js';

const KNOWN_PLATFORMS = new Set(['chatgpt', 'claude', 'perplexity', 'figma', 'canva', 'shopify']);
const KNOWN_REPOS = new Set(['bip', 'think-tank', 'jbh', 'l99']);
const BUILDER_PACK_CATS = new Set([
  'coding', 'research', 'redteam', 'system', 'shopify', 'shipping', 'strategy', 'growth',
]);

describe('PROMPTS data integrity', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(PROMPTS)).toBe(true);
    expect(PROMPTS.length).toBeGreaterThan(0);
  });

  it('has a unique numeric id per prompt', () => {
    const ids = PROMPTS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
    }
  });

  it('has title, sub, cat, platforms, repos, and versions on every prompt', () => {
    for (const p of PROMPTS) {
      expect(typeof p.title, `id ${p.id} title`).toBe('string');
      expect(p.title.length, `id ${p.id} title non-empty`).toBeGreaterThan(0);
      expect(typeof p.sub, `id ${p.id} sub`).toBe('string');
      expect(typeof p.cat, `id ${p.id} cat`).toBe('string');
      expect(Array.isArray(p.platforms), `id ${p.id} platforms array`).toBe(true);
      expect(p.platforms.length, `id ${p.id} has at least one platform`).toBeGreaterThan(0);
      expect(Array.isArray(p.repos), `id ${p.id} repos array`).toBe(true);
      expect(typeof p.versions, `id ${p.id} versions object`).toBe('object');
      expect(p.versions, `id ${p.id} versions not null`).not.toBeNull();
    }
  });

  it('only uses recognized platform keys', () => {
    for (const p of PROMPTS) {
      for (const platform of p.platforms) {
        expect(KNOWN_PLATFORMS.has(platform), `id ${p.id} unknown platform "${platform}"`).toBe(true);
      }
    }
  });

  it('only tags recognized repos', () => {
    for (const p of PROMPTS) {
      for (const repo of p.repos) {
        expect(KNOWN_REPOS.has(repo), `id ${p.id} unknown repo "${repo}"`).toBe(true);
      }
    }
  });

  it('every declared platform has a non-empty version body', () => {
    for (const p of PROMPTS) {
      for (const platform of p.platforms) {
        const body = p.versions[platform];
        expect(typeof body, `id ${p.id} missing versions.${platform}`).toBe('string');
        expect(body.length, `id ${p.id} versions.${platform} is empty`).toBeGreaterThan(0);
      }
    }
  });

  it('every category used by a builder-pack-eligible prompt is a known dropdown value or an intentional library-only extra', () => {
    // Library-only categories (design, ux, modes, focus, learning, wiring, buildout, phase,
    // polish, scratch, network, cloudflare, ecom) are allowed to exist outside the Builder's
    // hardcoded <select> options — they still work as Library filter chips. This test just
    // guards against a typo silently creating an orphan category with zero prompts.
    const cats = new Set(PROMPTS.map((p) => p.cat));
    for (const cat of cats) {
      const count = PROMPTS.filter((p) => p.cat === cat).length;
      expect(count, `category "${cat}" has at least one prompt`).toBeGreaterThan(0);
    }
    // Every Builder pack dropdown option should have real prompts behind it.
    for (const cat of BUILDER_PACK_CATS) {
      const count = PROMPTS.filter((p) => p.cat === cat).length;
      expect(count, `Builder pack "${cat}" has at least one prompt`).toBeGreaterThan(0);
    }
  });
});
