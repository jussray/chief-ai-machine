import {
  CUSTOM_PROMPTS_UPDATED_EVENT,
  STARRED_PROMPTS_UPDATED_EVENT,
  createLocalPromptId,
  migrateLegacyCustomStarIds,
  normalizeCustomPrompts,
  readCustomPromptState,
  readStarState,
  readStoredArray,
  readStoredArrayState,
  remapStarReferences,
  writeCustomPrompts as writeCanonicalCustomPrompts,
  writeStars as writeCanonicalStars,
} from './prompt-state.js';

export {
  CUSTOM_PROMPTS_UPDATED_EVENT,
  STARRED_PROMPTS_UPDATED_EVENT,
  createLocalPromptId,
  migrateLegacyCustomStarIds,
  normalizeCustomPrompts,
  readCustomPromptState,
  readStarState,
  readStoredArray,
  readStoredArrayState,
  remapStarReferences,
};

// Keep the historical adapter, but use the canonical journal-aware writers
// so every producer observes the same recovery boundary.
export const writeCustomPrompts = writeCanonicalCustomPrompts;
export const writeStars = writeCanonicalStars;
