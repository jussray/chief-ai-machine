import { canonicalFamilies } from './families.js';
import { validateRecipeSpec } from './compatibility.js';

export const CATALOG_TARGET = 5000;
export const CATALOG_VERSION = 'catalog-v1';

function stableRank(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function titleFor(family, spec) {
  const stage = spec.stage[0].toUpperCase() + spec.stage.slice(1);
  const mode = spec.modes[0].replace(/-/g, ' ');
  return `${family.title} — ${stage} / ${mode}`;
}

function descriptionFor(family, spec) {
  return `${family.title} for ${spec.stage} work with a ${spec.riskLens} lens on ${spec.platform}.`;
}

export function candidateSpecs() {
  const out = [];
  for (const family of Object.values(canonicalFamilies)) {
    for (const platform of family.allowedPlatforms) {
      for (const stage of family.allowedStages) {
        for (const mode of family.allowedModes) {
          for (const riskLens of family.allowedRiskLenses) {
            out.push({
              familyId: family.id,
              platform,
              stage,
              modes: [mode],
              riskLens,
            });
          }
        }
      }
    }
  }
  return out;
}

export function recipeFromSpec(spec) {
  const check = validateRecipeSpec(spec);
  if (!check.valid) return { ok: false, errors: check.errors };

  const family = check.family;
  const tuple = [
    family.id,
    spec.platform,
    spec.stage,
    spec.modes.join('.'),
    spec.riskLens,
    CATALOG_VERSION,
  ].join('|');

  return {
    ok: true,
    recipe: {
      id: tuple,
      title: titleFor(family, spec),
      description: descriptionFor(family, spec),
      pack: family.pack,
      familyId: family.id,
      clauseIds: [],
      platform: spec.platform,
      stage: spec.stage,
      modes: [...spec.modes],
      riskLens: spec.riskLens,
      inputs: [...family.requiredInputs],
      status: 'generated',
      version: CATALOG_VERSION,
    },
  };
}

export function buildCatalogRecipes({ target = CATALOG_TARGET } = {}) {
  const valid = [];
  const rejected = [];

  for (const spec of candidateSpecs()) {
    const result = recipeFromSpec(spec);
    if (!result.ok) {
      rejected.push({ spec, reason: result.errors.join('; ') });
      continue;
    }
    valid.push(result.recipe);
  }

  if (valid.length < target) {
    throw new Error(`Only ${valid.length}/${target} valid recipes are available.`);
  }

  // Rank the complete candidate pool before truncating. This makes selection
  // independent of canonical-family declaration order and prevents the last
  // family in families.js from silently losing most of its coverage.
  valid.sort((a, b) => {
    const rankDelta = stableRank(a.id) - stableRank(b.id);
    return rankDelta || a.id.localeCompare(b.id);
  });

  const selected = valid.slice(0, target);
  const ids = new Set(selected.map((recipe) => recipe.id));
  if (ids.size !== selected.length) {
    throw new Error('Catalog recipe ids are not unique.');
  }

  return {
    recipes: selected,
    rejected,
    candidateCount: valid.length,
  };
}
