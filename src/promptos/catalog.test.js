import { describe, expect, it } from 'vitest';
import { buildCatalogRecipes } from './catalog/buildCatalog.js';
import { canonicalFamilies } from './catalog/families.js';
import { compilePrompt } from './compiler/compilePrompt.js';
import { openPromptCard } from './openPromptCard.js';

function realInputsFor(family) {
  return Object.fromEntries(family.requiredInputs.map((key) => [key, `sample-${key}`]));
}

function baseRecipeFor(familyId, overrides = {}) {
  const family = canonicalFamilies[familyId];
  return {
    id: 'test.recipe',
    title: 'Test Recipe',
    description: 'Test',
    pack: family.pack,
    familyId: family.id,
    clauseIds: [],
    platform: family.allowedPlatforms[0],
    stage: family.allowedStages[0],
    modes: [family.allowedModes[0]],
    riskLens: family.allowedRiskLenses[0],
    inputs: family.requiredInputs,
    status: 'generated',
    version: 'catalog-v1',
    ...overrides,
  };
}

describe('compilePrompt', () => {
  const family = canonicalFamilies['repo.audit.first'];
  const baseRecipe = baseRecipeFor('repo.audit.first', {
    platform: 'claude',
    stage: 'audit',
    modes: ['redteam'],
    riskLens: 'security',
  });

  it('compiles a ready-to-copy prompt with every required input embedded', () => {
    const inputs = realInputsFor(family);
    const result = compilePrompt(baseRecipe, inputs);
    expect(result.ok).toBe(true);
    expect(result.readyToCopy).toBe(true);
    expect(result.missingInputs).toEqual([]);
    for (const value of Object.values(inputs)) expect(result.prompt).toContain(value);
  });

  it('reports missing inputs and keeps placeholders visible', () => {
    const result = compilePrompt(baseRecipe, { repoName: 'chief-ai-machine' });
    expect(result.ok).toBe(true);
    expect(result.readyToCopy).toBe(false);
    expect(result.prompt).toContain('chief-ai-machine');
    expect(result.prompt).toContain('[goal]');
    expect(result.missingInputs).toEqual(
      expect.arrayContaining(['branchOrPr', 'commitHead', 'stack', 'goal']),
    );
  });

  it('changes prompt text when stage or risk lens changes', () => {
    const inputs = realInputsFor(family);
    const audit = compilePrompt({ ...baseRecipe, stage: 'audit' }, inputs);
    const launch = compilePrompt({ ...baseRecipe, stage: 'launch' }, inputs);
    const pricing = compilePrompt({ ...baseRecipe, riskLens: 'pricing' }, inputs);
    expect(audit.prompt).not.toBe(launch.prompt);
    expect(audit.prompt).not.toBe(pricing.prompt);
  });

  it('rejects a platform the family does not allow', () => {
    const result = compilePrompt({ ...baseRecipe, platform: 'shopify' }, realInputsFor(family));
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toMatch(/shopify is not valid/);
  });
});

describe('catalog construction', () => {
  const built = buildCatalogRecipes();

  it('contains exactly 5,000 unique recipes without relying on a generated file', () => {
    expect(built.recipes).toHaveLength(5000);
    expect(new Set(built.recipes.map((recipe) => recipe.id)).size).toBe(5000);
    expect(built.candidateCount).toBeGreaterThan(5000);
    expect(built.rejected).toHaveLength(0);
  });

  it('does not starve a canonical family because of declaration order', () => {
    const counts = new Map();
    for (const recipe of built.recipes) {
      counts.set(recipe.familyId, (counts.get(recipe.familyId) ?? 0) + 1);
    }
    for (const familyId of Object.keys(canonicalFamilies)) {
      expect(counts.get(familyId) ?? 0).toBeGreaterThanOrEqual(400);
    }
  });

  it('every selected recipe recompiles with its own required inputs', () => {
    for (const recipe of built.recipes) {
      const inputs = Object.fromEntries(recipe.inputs.map((key) => [key, `sample-${key}`]));
      const result = compilePrompt(recipe, inputs);
      expect(result.ok).toBe(true);
      expect(result.readyToCopy).toBe(true);
      for (const value of Object.values(inputs)) expect(result.prompt).toContain(value);
    }
  });
});

describe('openPromptCard', () => {
  it('shapes a compiled recipe into display data', () => {
    const family = canonicalFamilies['debug.without.thrashing'];
    const recipe = baseRecipeFor('debug.without.thrashing', {
      id: 'test.card',
      title: 'Debug Card',
      stage: 'debug',
      modes: ['root-cause'],
      riskLens: 'correctness',
    });
    const card = openPromptCard(recipe, realInputsFor(family), {});
    expect(card.ok).toBe(true);
    expect(card.readyToCopy).toBe(true);
    expect(card.tags).toContain('debug');
    expect(card.preview).toContain('sample-feature');
  });
});
