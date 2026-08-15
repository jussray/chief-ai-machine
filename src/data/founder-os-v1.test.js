import { describe, expect, it } from 'vitest';
import { FOUNDER_OS_V1_PACK_VERSION, FOUNDER_OS_V1_PROMPTS } from './founder-os-v1.js';

describe('Founder OS v1 prompt pack', () => {
  it('keeps the Chief AI → PromptOS → FCR separation explicit', () => {
    expect(FOUNDER_OS_V1_PACK_VERSION).toBe('founder-os-public-v1');
    expect(FOUNDER_OS_V1_PROMPTS).toHaveLength(1);

    const text = FOUNDER_OS_V1_PROMPTS[0].versions.chatgpt;
    expect(text).toMatch(/Chief AI owns intent interpretation/i);
    expect(text).toMatch(/PromptOS compiles/i);
    expect(text).toMatch(/FCR owns project resolution, authority, provider execution/i);
  });

  it('requires exact-head, Playwright, analytics measurement, and bounded authority', () => {
    const text = FOUNDER_OS_V1_PROMPTS[0].versions.chatgpt;

    expect(text).toMatch(/exact current main/i);
    expect(text).toMatch(/UI\/runtime claims require Playwright/i);
    expect(text).toMatch(/baseline, decision metric, and post-change measurement/i);
    expect(text).toMatch(/authority ceiling L0–L6/i);
    expect(text).toMatch(/may never expand its own authority/i);
  });
});
