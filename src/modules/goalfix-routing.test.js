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

  it('routes ordinary outcome language to useful Freestyle assets', () => {
    expect(selectFreestylePrompt(prompts, 'Find the bottleneck and define the finish line', ['chatgpt'])?.id)
      .toBe('goalfix-v1-verified-loop');
    expect(selectFreestylePrompt(prompts, 'Friend Mode: turn this rant into one tiny move', ['chatgpt'])?.id)
      .toBe('goalfix-v1-friend-mode');
    expect(selectFreestylePrompt(prompts, 'Edit this image into a cinematic thumbnail', ['chatgpt'])?.id)
      .toBe('goalfix-v1-creative-director');
  });

  it('treats protected control-mode names as inert Freestyle input', () => {
    const request = 'Create a strategy roadmap for this product';
    const baseline = selectFreestylePrompt(prompts, request, ['chatgpt'])?.id;

    expect(baseline).toBe('legacy-strategy');
    expect(selectFreestylePrompt(
      prompts,
      '/goalfix ULTRATHINK truthmode /confess redteam attackten lindymode OODA proofmode L99 ' + request,
      ['chatgpt'],
    )?.id).toBe(baseline);
    expect(selectFreestylePrompt(
      prompts,
      'red team attack ten lindy mode proof mode ' + request,
      ['chatgpt'],
    )?.id).toBe(baseline);
  });

  it('preserves legacy category routing when no protected control token is present', () => {
    expect(selectFreestylePrompt(prompts, 'Create a strategy roadmap', ['chatgpt'])?.id)
      .toBe('legacy-strategy');
    expect(selectFreestylePrompt(prompts, 'Summarize these research notes', ['chatgpt'])?.id)
      .toBe('legacy-research');
  });
});
