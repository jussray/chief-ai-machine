import { describe, expect, it } from 'vitest';
import { FOUNDER_OS_V1_PROMPTS } from '../data/founder-os-v1.js';
import { selectBuilderPrompt } from './builder.js';

describe('Founder OS prompt routing', () => {
  it('selects the exact Founder OS mission compiler in Builder', () => {
    expect(
      selectBuilderPrompt(
        FOUNDER_OS_V1_PROMPTS,
        'prompt:founder-os-v1-mission-compiler',
        'chatgpt',
      )?.id,
    ).toBe('founder-os-v1-mission-compiler');
  });
});
