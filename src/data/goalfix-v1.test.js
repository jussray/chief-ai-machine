import { describe, expect, it } from 'vitest';
import {
  GOALFIX_V1_PACK_VERSION,
  GOALFIX_V1_PRIVATE_BOUNDARY,
  GOALFIX_V1_PROMPTS,
} from './goalfix-v1.js';

const allVersionText = GOALFIX_V1_PROMPTS
  .flatMap(prompt => Object.values(prompt.versions || {}))
  .join('\n');

const continuityChain = 'REACQUIRE → CLASSIFY → REPAIR → ROLL FORWARD → EXPIRE PROOF → VERIFY → PLAYWRIGHT → REVIEW → MERGE GATE → POST-MERGE TRUTH';

describe('Goalfix v1 public prompt pack', () => {
  it('publishes the bounded v1 contract without exposing private FutureYOU/me internals', () => {
    expect(GOALFIX_V1_PACK_VERSION).toBe('goalfix-public-v1.1');
    expect(GOALFIX_V1_PROMPTS).toHaveLength(3);
    expect(GOALFIX_V1_PRIVATE_BOUNDARY).toContain('FutureYOU/me adaptation logic');

    const ids = GOALFIX_V1_PROMPTS.map(prompt => prompt.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const forbidden of [
      'Black woman from Philly',
      'solo-raising 8 kids',
      'Pinecone/Milvus',
      'private evaluation dataset contents',
    ]) {
      expect(allVersionText).not.toContain(forbidden);
    }
  });

  it('locks Goalfix to the end-to-end existing-carrier continuity loop', () => {
    const prompt = GOALFIX_V1_PROMPTS.find(item => item.id === 'goalfix-v1-verified-loop');
    const text = prompt.versions.chatgpt;

    expect(text).toContain(continuityChain);
    for (const required of ['REALITY', 'FIX', 'PROOF', 'RISK', 'ROLLBACK', 'NEXT GATE']) {
      expect(text).toContain(required);
    }
    expect(text).toMatch(/preserve the existing PR\/carrier/i);
    expect(text).toMatch(/same carrier/i);
    expect(text).toMatch(/Never inherit predecessor green/i);
    expect(text).toMatch(/metadata-only failure gets a metadata repair/i);
    expect(text).toMatch(/targeted Playwright/i);
    expect(text).toMatch(/skipped required checks remain blockers/i);
    expect(text).toMatch(/expected head SHA/i);
    expect(text).toMatch(/actual landed merge\/main SHA/i);
    expect(text).toMatch(/Never weaken rulesets/i);
  });

  it('keeps Friend Mode life + build capable without demographic voice inference or fake memory', () => {
    const prompt = GOALFIX_V1_PROMPTS.find(item => item.id === 'goalfix-v1-friend-mode');
    const text = prompt.versions.chatgpt;

    expect(text).toContain('money, people, build, health, kids, legal, rest');
    expect(text).toMatch(/Never infer slang or persona from race, gender, location, or family structure/i);
    expect(text).toMatch(/Do not assume durable memory/i);
    expect(text).toMatch(/exactly one action/i);
  });

  it('compresses the image-editing playbook into one reusable creative-director contract', () => {
    const prompt = GOALFIX_V1_PROMPTS.find(item => item.id === 'goalfix-v1-creative-director');
    const text = prompt.versions.chatgpt;

    for (const required of ['KEEP', 'CHANGE', 'STYLE', 'USE', 'QUALITY GATE']) {
      expect(text).toContain(required);
    }
    expect(prompt.notes).toMatch(/instead of ten near-duplicate prompts/i);
  });
});
