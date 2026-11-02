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
} from './prompt-state.js';
import { commitLocalFirstValue } from './local-first.js';

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

function emitStateEvent(name) {
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  window.dispatchEvent(new window.Event(name));
}

export function writeCustomPrompts(prompts) {
  const safe = normalizeCustomPrompts(Array.isArray(prompts) ? prompts : []).prompts;
  const receipt = commitLocalFirstValue(localStorage, {
    storageKey: 'chief-custom',
    scope: 'custom-prompts',
    value: safe,
  });
  emitStateEvent(CUSTOM_PROMPTS_UPDATED_EVENT);
  return receipt;
}

export function writeStars(stars) {
  const safe = Array.isArray(stars)
    ? [...new Set(stars.filter(value => (
      (typeof value === 'string' && value.length > 0 && value.length <= 180)
      || (typeof value === 'number' && Number.isSafeInteger(value))
    )))]
    : [];
  const receipt = commitLocalFirstValue(localStorage, {
    storageKey: 'chief-stars',
    scope: 'starred-prompts',
    value: safe,
  });
  emitStateEvent(STARRED_PROMPTS_UPDATED_EVENT);
  return receipt;
}
