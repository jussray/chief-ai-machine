import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildCatalogRecipes, CATALOG_TARGET } from '../src/promptos/catalog/buildCatalog.js';
import { compilePrompt } from '../src/promptos/compiler/compilePrompt.js';

function countBy(list, keyFn) {
  const counts = {};
  for (const item of list) {
    const key = keyFn(item);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

function normalizeText(prompt) {
  return prompt
    .toLowerCase()
    .replace(/\[[a-z0-9_]+\]/gi, '[variable]')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stableHash(value) {
  return createHash('sha256').update(value).digest('hex').slice(0, 16);
}

const { recipes: recipeIndex, rejected, candidateCount } = buildCatalogRecipes();
const recipes = [];
const fingerprints = new Set();

for (const recipe of recipeIndex) {
  const placeholderInputs = Object.fromEntries(recipe.inputs.map((key) => [key, `[${key}]`]));
  const compiled = compilePrompt(recipe, placeholderInputs);
  if (!compiled.ok || !compiled.readyToCopy) {
    throw new Error(`Recipe ${recipe.id} failed compilation: ${(compiled.errors ?? []).join('; ')}`);
  }

  const fingerprint = stableHash(normalizeText(compiled.prompt));
  if (fingerprints.has(fingerprint)) {
    throw new Error(`Semantic duplicate detected for recipe ${recipe.id}`);
  }
  fingerprints.add(fingerprint);

  recipes.push({
    ...recipe,
    preview: compiled.prompt.slice(0, 220),
    fingerprint: normalizeText(compiled.prompt).slice(0, 300),
    estimatedPromptLength: compiled.prompt.length,
    provenance: {
      canonicalFamilyId: recipe.familyId,
      clauseIds: compiled.provenance.appliedClauseIds,
      generatorVersion: recipe.version,
    },
  });
}

if (recipes.length !== CATALOG_TARGET) {
  throw new Error(`Generated ${recipes.length}/${CATALOG_TARGET} recipes.`);
}

await fs.mkdir('artifacts/promptos', { recursive: true });
const selectionDigest = createHash('sha256')
  .update(recipes.map((recipe) => recipe.id).join('\n'))
  .digest('hex');
await fs.writeFile(
  'artifacts/promptos/catalog-quality-report.json',
  JSON.stringify({
    generatedAt: process.env.CATALOG_BUILD_STAMP ?? null,
    target: CATALOG_TARGET,
    candidateCount,
    total: recipes.length,
    rejected: rejected.length,
    uniqueFingerprints: fingerprints.size,
    selectionDigest,
    byFamily: countBy(recipes, (r) => r.familyId),
    byPack: countBy(recipes, (r) => r.pack),
    byPlatform: countBy(recipes, (r) => r.platform),
    byStage: countBy(recipes, (r) => r.stage),
    byRiskLens: countBy(recipes, (r) => r.riskLens),
    averagePromptLength: Math.round(
      recipes.reduce((total, recipe) => total + recipe.estimatedPromptLength, 0) / recipes.length,
    ),
  }, null, 2),
);

console.log(`Generated ${recipes.length} validated recipes from ${candidateCount} valid candidates.`);
