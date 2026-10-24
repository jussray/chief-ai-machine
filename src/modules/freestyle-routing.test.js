import { describe, expect, it } from 'vitest';
import { selectFreestylePrompt, stripProtectedControlTokens } from './freestyle.js';

const PROMPTS = [
  { id: 'strategy-prompt', title: 'OODA Loop Mode', cat: 'strategy', platforms: ['chatgpt'] },
  { id: 'goalfix-v1-verified-loop', title: 'Goalfix v1 — Verified Goal Loop', cat: 'coding', platforms: ['chatgpt'] },
  { id: 'redteam-prompt', title: 'Red Team Mode', cat: 'redteam', platforms: ['chatgpt'] },
];

describe('Freestyle protected control-mode routing', () => {
  it('does not let command names override the actual strategy request', () => {
    const request = 'Create a strategy roadmap for this product';
    const baseline = selectFreestylePrompt(PROMPTS, request, ['chatgpt']);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const withControls = selectFreestylePrompt(
        PROMPTS,
        '/goalfix ULTRATHINK truthmode /confess redteam attackten lindymode OODA proofmode L99 ' + request,
        ['chatgpt'],
      );
      expect(withControls.id).toBe(baseline.id);
      expect(withControls.title).toBe('OODA Loop Mode');
    }
  });

  it('keeps normal non-control Goalfix intent matching functional', () => {
    expect(selectFreestylePrompt(PROMPTS, 'Find the bottleneck to my finish line', ['chatgpt']).id)
      .toBe('goalfix-v1-verified-loop');
  });

  it('does not treat bare protected tokens as Goalfix content', () => {
    expect(stripProtectedControlTokens('/goalfix proofmode OODA L99')).toBe('');
    expect(selectFreestylePrompt(PROMPTS, '/goalfix proofmode OODA L99', ['chatgpt']).id)
      .toBe('strategy-prompt');
  });
});
