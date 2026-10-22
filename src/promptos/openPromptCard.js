// src/promptos/openPromptCard.js
//
// Card-open wiring: given a lightweight catalog recipe and the user's
// current inputs, compile the one prompt that recipe currently represents.

import { compilePrompt } from "./compiler/compilePrompt.js";

export function openPromptCard(recipe, userInput, appContext) {
  const result = compilePrompt(recipe, userInput, appContext);

  return {
    title: recipe.title,
    description: recipe.description,
    tags: [
      recipe.pack,
      recipe.platform,
      recipe.stage,
      ...recipe.modes,
      recipe.riskLens,
      recipe.status
    ],
    preview: result.prompt,
    ok: result.ok,
    errors: result.errors ?? [],
    readyToCopy: result.readyToCopy ?? false,
    missingInputs: result.missingInputs ?? [],
    provenance: result.provenance,
    recommendedBecause: [
      `Selected family: ${recipe.familyId}`,
      `Selected platform: ${recipe.platform}`,
      `Selected stage: ${recipe.stage}`,
      `Applied mode: ${recipe.modes.join(", ")}`
    ]
  };
}
