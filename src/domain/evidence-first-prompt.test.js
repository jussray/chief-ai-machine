import { describe, expect, it } from 'vitest';
import { PROMPTS } from '../data/prompts.js';
import {
  EVIDENCE_FIRST_FLOOR,
  applyEvidenceFirstContract,
  hasEvidenceFirstContract,
} from './evidence-first-prompt.js';

const REQUIRED_TERMS = [
  'authoritative repository',
  'target branch or pr',
  'exact head',
  'evidence hierarchy',
  'verified',
  'inferred',
  'unknown',
  'blocked',
  'stop condition',
  'rollback',
  'playwright',
  'exhaust available evidence before asking questions',
];

describe('library-wide evidence-first prompt floor', () => {
  it('applies the complete contract to every built-in platform variant', () => {
    let checked = 0;

    for (const prompt of PROMPTS) {
      for (const [platform, value] of Object.entries(prompt.versions || {})) {
        const rendered = applyEvidenceFirstContract(value);
        const normalized = rendered.toLowerCase();

        expect(rendered, `${prompt.title} / ${platform} renders a prompt`).not.toBe('');
        for (const term of REQUIRED_TERMS) {
          expect(normalized, `${prompt.title} / ${platform} requires "${term}"`).toContain(term);
        }
        checked += 1;
      }
    }

    expect(checked).toBeGreaterThan(PROMPTS.length);
  });

  it('does not duplicate an already compliant prompt', () => {
    const prompt = PROMPTS.find((candidate) => candidate.title === 'Repo Audit First');
    if (!prompt) throw new Error('Repo Audit First prompt is missing');

    for (const value of Object.values(prompt.versions)) {
      expect(hasEvidenceFirstContract(value)).toBe(true);
      expect(applyEvidenceFirstContract(value)).toBe(value);
      expect(value.includes('EVIDENCE-FIRST FLOOR:')).toBe(false);
    }
  });

  it('protects custom and future prompt families without mutating their source', () => {
    const original = 'Draft a launch announcement from the supplied facts.';
    const rendered = applyEvidenceFirstContract(original);

    expect(original).toBe('Draft a launch announcement from the supplied facts.');
    expect(rendered).toBe(`${original}${EVIDENCE_FIRST_FLOOR}`);
    expect(rendered).toContain('For generative-only work');
  });

  it('returns an empty string for missing prompt content', () => {
    expect(applyEvidenceFirstContract()).toBe('');
    expect(applyEvidenceFirstContract('   ')).toBe('');
  });
});
