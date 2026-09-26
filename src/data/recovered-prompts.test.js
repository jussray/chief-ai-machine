import { describe, expect, it } from 'vitest';
import { PROMPTS } from './prompts.js';
import { GOALFIX_V1_PROMPTS } from './goalfix-v1.js';
import { RECOVERED_PROMPTS } from './recovered-prompts.js';

const BUILT_INS = [...PROMPTS, ...GOALFIX_V1_PROMPTS, ...RECOVERED_PROMPTS];

function normalized(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

describe('recovered PromptOS catalog', () => {
  it('recovers exactly 21 distinct jobs and brings the built-in library to 204', () => {
    expect(PROMPTS).toHaveLength(180);
    expect(GOALFIX_V1_PROMPTS).toHaveLength(3);
    expect(RECOVERED_PROMPTS).toHaveLength(21);
    expect(BUILT_INS).toHaveLength(204);
  });

  it('does not collide on id or title with the current library', () => {
    const ids = BUILT_INS.map((prompt) => String(prompt.id));
    const titles = BUILT_INS.map((prompt) => normalized(prompt.title));

    expect(new Set(ids).size).toBe(BUILT_INS.length);
    expect(new Set(titles).size).toBe(BUILT_INS.length);
  });

  it('keeps every recovered prompt executable on every declared platform', () => {
    for (const prompt of RECOVERED_PROMPTS) {
      expect(prompt.id).toMatch(/^recovered-/);
      expect(prompt.title?.trim().length).toBeGreaterThan(3);
      expect(prompt.notes?.trim().length).toBeGreaterThan(20);
      expect(prompt.platforms.length).toBeGreaterThan(0);

      for (const platform of prompt.platforms) {
        expect(typeof prompt.versions?.[platform]).toBe('string');
        expect(prompt.versions[platform].trim().length).toBeGreaterThan(40);
      }
    }
  });

  it('keeps the five formerly-overlapping jobs purposefully differentiated', () => {
    const titles = new Set(RECOVERED_PROMPTS.map((prompt) => prompt.title));
    for (const title of [
      'Outcome-Verified Launch Proof',
      'Trust Boundary Abuse Matrix',
      'Revenue-to-Ops Leak Audit',
      'Offer-to-Creative Evidence Translator',
      'Next-Level Breakpoint Simulator',
    ]) {
      expect(titles.has(title)).toBe(true);
    }
  });
});
