import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PROMPTS } from '../data/prompts.js';
import {
  EVIDENCE_FIRST_FLOOR,
  applyEvidenceFirstContract,
  hasEvidenceFirstContract,
  renderPromptVariant,
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
];

const PROMPT_EXIT_MODULES = [
  '../modules/modal.js',
  '../modules/builder.js',
  '../modules/freestyle.js',
];

describe('library-wide evidence-first prompt floor', () => {
  it('applies the complete contract to every built-in platform variant', () => {
    let checked = 0;

    for (const prompt of PROMPTS) {
      for (const [platform, value] of Object.entries(prompt.versions || {})) {
        const rendered = renderPromptVariant(prompt, platform);
        const normalized = rendered.toLowerCase();

        expect(rendered, `${prompt.title} / ${platform} renders a prompt`).not.toBe('');
        for (const term of REQUIRED_TERMS) {
          expect(normalized, `${prompt.title} / ${platform} requires "${term}"`).toContain(term);
        }
        expect(normalized, `${prompt.title} / ${platform} exhausts evidence before questions`)
          .toMatch(/exhaust available (repository )?evidence before asking questions/);
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

  it('replaces typed placeholders before applying the shared floor', () => {
    const prompt = {
      versions: {
        chatgpt: 'Repository [REPO]\nOwner repository [OWNER/REPO]\nTask [TASK]\nConstraints [CONSTRAINTS]',
      },
    };
    const rendered = renderPromptVariant(prompt, 'chatgpt', {
      REPO: 'jussray/chief-ai-machine',
      'OWNER/REPO': 'jussray/chief-ai-machine',
      TASK: 'govern every prompt exit',
      CONSTRAINTS: 'preserve specialized instructions',
    });

    expect(rendered).toContain('Repository jussray/chief-ai-machine');
    expect(rendered).toContain('Owner repository jussray/chief-ai-machine');
    expect(rendered).toContain('Task govern every prompt exit');
    expect(rendered).toContain('Constraints preserve specialized instructions');
    expect(rendered.match(/EVIDENCE-FIRST FLOOR:/g)).toHaveLength(1);
  });

  it('falls back to the first available platform without bypassing governance', () => {
    const prompt = { versions: { claude: 'Review the supplied change.' } };
    const rendered = renderPromptVariant(prompt, 'chatgpt');

    expect(rendered).toContain('Review the supplied change.');
    expect(rendered).toContain('EVIDENCE-FIRST FLOOR:');
  });

  it('protects custom and future prompt families without mutating their source', () => {
    const original = 'Draft a launch announcement from the supplied facts.';
    const rendered = applyEvidenceFirstContract(original);

    expect(original).toBe('Draft a launch announcement from the supplied facts.');
    expect(rendered).toBe(`${original}${EVIDENCE_FIRST_FLOOR}`);
    expect(rendered).toContain('For generative-only work');
  });

  it('routes every reusable prompt exit through the governed renderer', () => {
    const combined = PROMPT_EXIT_MODULES
      .map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'))
      .join('\n');

    for (const path of PROMPT_EXIT_MODULES) {
      const source = readFileSync(new URL(path, import.meta.url), 'utf8');
      expect(source, `${path} imports or calls the governed renderer`).toContain('renderPromptVariant');
    }

    for (const legacyBypass of [
      'matches[0].versions[platform]',
      'currentResult.versions[currentPlatform]',
      'prompt.versions[currentTab]',
    ]) {
      expect(combined, `prompt exits reject legacy bypass ${legacyBypass}`).not.toContain(legacyBypass);
    }
  });

  it('returns an empty string for missing prompt content', () => {
    expect(applyEvidenceFirstContract()).toBe('');
    expect(applyEvidenceFirstContract('   ')).toBe('');
    expect(renderPromptVariant()).toBe('');
  });
});
