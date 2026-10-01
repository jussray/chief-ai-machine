import { describe, expect, it } from 'vitest';
import { GOALFIX_V1_PROMPTS } from '../data/goalfix-v1.js';
import { selectBuilderPrompt } from './builder.js';
import { selectFreestylePrompt } from './freestyle.js';

const legacy = [
  {
    id: 'legacy-system',
    cat: 'system',
    platforms: ['chatgpt'],
    versions: { chatgpt: 'legacy' },
  },
  {
    id: 'legacy-persona',
    cat: 'persona',
    platforms: ['chatgpt'],
    versions: { chatgpt: 'legacy' },
  },
  {
    id: 'legacy-strategy',
    cat: 'strategy',
    platforms: ['chatgpt'],
    versions: { chatgpt: 'legacy' },
  },
  {
    id: 'legacy-research',
    cat: 'research',
    platforms: ['chatgpt'],
    versions: { chatgpt: 'legacy' },
  },
];
const prompts = [...legacy, ...GOALFIX_V1_PROMPTS];

describe('Goalfix v1 prompt routing', () => {
  it('selects an exact Goalfix asset in Builder instead of the first legacy category match', () => {
    expect(
      selectBuilderPrompt(prompts, 'prompt:goalfix-v1-verified-loop', 'chatgpt')?.id,
    ).toBe('goalfix-v1-verified-loop');
    expect(
      selectBuilderPrompt(prompts, 'prompt:goalfix-v1-friend-mode', 'chatgpt')?.id,
    ).toBe('goalfix-v1-friend-mode');
    expect(
      selectBuilderPrompt(prompts, 'prompt:goalfix-v1-creative-director', 'chatgpt')?.id,
    ).toBe('goalfix-v1-creative-director');
  });

  it('routes ordinary outcome language and Friend Mode and image-edit intents in Freestyle', () => {
    expect(selectFreestylePrompt(prompts, 'Find the bottleneck and define the finish line', ['chatgpt'])?.id)
      .toBe('goalfix-v1-verified-loop');
    expect(selectFreestylePrompt(prompts, 'Friend Mode: turn this rant into one tiny move', ['chatgpt'])?.id)
      .toBe('goalfix-v1-friend-mode');
    expect(selectFreestylePrompt(prompts, 'Edit this image into a cinematic thumbnail', ['chatgpt'])?.id)
      .toBe('goalfix-v1-creative-director');
  });

  it('treats protected control-mode names as inert Freestyle input', () => {
    const baseline = selectFreestylePrompt(prompts, 'Help me plan something', ['chatgpt']);
    const withTokens = selectFreestylePrompt(
      prompts,
      'goalfix ultrathink truthmode confess redteam attackten lindymode ooda proofmode l99 Help me plan something',
      ['chatgpt'],
    );
    expect(withTokens?.id).toBe(baseline?.id);
  });

  it('preserves legacy category routing when no protected control token is present', () => {
    expect(selectFreestylePrompt(prompts, 'Create a strategy roadmap', ['chatgpt'])?.id)
      .toBe('legacy-strategy');
    expect(selectFreestylePrompt(prompts, 'Tell me about recent discoveries', ['chatgpt'])?.id)
      .toBe('legacy-research');
  });
});
