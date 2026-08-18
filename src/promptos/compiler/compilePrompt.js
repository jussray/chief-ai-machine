import { canonicalFamilies } from '../catalog/families.js';
import { clauses } from '../catalog/clauses.js';
import { validateRecipeSpec, shouldRequirePlaywright } from '../catalog/compatibility.js';
import { getPlatformAdapter } from './platformAdapters.js';

function readTemplate(value, input) {
  return value.replace(/\[([A-Z0-9_]+)\]/g, (_, rawKey) => {
    const key = rawKey
      .toLowerCase()
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    return input[key] || `[${rawKey}]`;
  });
}

function missingRequiredInputs(requiredInputs, input) {
  return requiredInputs.filter((key) => !String(input[key] ?? '').trim());
}

function unique(ids) {
  return [...new Set(ids)];
}

function inputContext(requiredInputs, input) {
  const rows = requiredInputs.map((key) => {
    const value = String(input[key] ?? '').trim();
    return `- ${key}: ${value || `[${key}]`}`;
  });

  return `FOUNDER INPUT CONTEXT\nUse these values as the concrete task context. Do not silently invent missing values.\n${rows.join('\n')}`;
}

export function compilePrompt(recipe, input = {}, appContext = {}) {
  const validation = validateRecipeSpec(recipe, appContext);

  if (!validation.valid) {
    return {
      ok: false,
      readyToCopy: false,
      errors: validation.errors,
      prompt: '',
      missingInputs: recipe.inputs ?? [],
      provenance: null,
    };
  }

  const family = canonicalFamilies[recipe.familyId];
  const requiredInputs = recipe.inputs ?? family.requiredInputs;
  const missing = missingRequiredInputs(requiredInputs, input);

  const appliedClauseIds = unique([
    ...family.baseClauseIds,
    ...(recipe.clauseIds ?? []),
    ...(recipe.modes ?? []).map((mode) => `mode.${mode}`),
    `stage.${recipe.stage}`,
    `risklens.${recipe.riskLens}`,
    ...(shouldRequirePlaywright(recipe, input)
      ? ['verification.playwright-if-ui']
      : []),
  ]);

  const unresolvedClauseIds = appliedClauseIds.filter((id) => !clauses[id]);
  if (unresolvedClauseIds.length) {
    return {
      ok: false,
      readyToCopy: false,
      errors: [`Missing clauses: ${unresolvedClauseIds.join(', ')}`],
      prompt: '',
      missingInputs: missing,
      provenance: null,
    };
  }

  const adapter = getPlatformAdapter(recipe.platform);
  const clauseBody = appliedClauseIds
    .map((id) => readTemplate(clauses[id].body, input))
    .filter(Boolean)
    .join('\n\n');

  const body = `${inputContext(requiredInputs, input)}\n\n${clauseBody}`;
  const prompt = adapter.wrap({ title: recipe.title, body, input });

  return {
    ok: true,
    readyToCopy: missing.length === 0,
    prompt,
    missingInputs: missing,
    errors: [],
    provenance: {
      recipeId: recipe.id,
      canonicalFamilyId: family.id,
      appliedClauseIds,
      platform: recipe.platform,
      generatorVersion: recipe.version,
      compiledAt: input.__compiledAt ?? null,
    },
  };
}
