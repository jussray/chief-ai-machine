// src/promptos/catalog/compatibility.js
//
// Blocks bad combinations before they enter the catalog or get compiled.

import { canonicalFamilies } from "./families.js";

const integrationPlatforms = new Set(["figma", "canva", "shopify"]);

export function validateRecipeSpec(spec, appContext = {}) {
  const family = canonicalFamilies[spec.familyId];
  const errors = [];

  if (!family) {
    errors.push(`Unknown family: ${spec.familyId}`);
    return { valid: false, errors };
  }

  if (!family.allowedPlatforms.includes(spec.platform)) {
    errors.push(`${spec.platform} is not valid for ${spec.familyId}`);
  }

  if (!family.allowedStages.includes(spec.stage)) {
    errors.push(`${spec.stage} is not valid for ${spec.familyId}`);
  }

  for (const mode of spec.modes ?? []) {
    if (!family.allowedModes.includes(mode)) {
      errors.push(`${mode} is not valid for ${spec.familyId}`);
    }
  }

  if (!family.allowedRiskLenses.includes(spec.riskLens)) {
    errors.push(`${spec.riskLens} is not valid for ${spec.familyId}`);
  }

  if (
    integrationPlatforms.has(spec.platform) &&
    appContext.activeIntegrations &&
    !appContext.activeIntegrations.includes(spec.platform)
  ) {
    errors.push(`${spec.platform} integration is not active`);
  }

  return {
    valid: errors.length === 0,
    errors,
    family
  };
}

export function shouldRequirePlaywright(recipe, input) {
  return Boolean(
    input?.touchesUi ||
    input?.renderedBrowserFlow ||
    recipe.pack === "ux-ui-design" ||
    recipe.riskLens === "ux"
  );
}
