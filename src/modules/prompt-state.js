export const CUSTOM_PROMPTS_UPDATED_EVENT = 'chief-custom-updated';
export const STARRED_PROMPTS_UPDATED_EVENT = 'chief-stars-updated';

export function readStoredArray(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function emitStateEvent(name) {
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  window.dispatchEvent(new window.Event(name));
}

export function writeCustomPrompts(prompts) {
  const safe = Array.isArray(prompts) ? prompts : [];
  localStorage.setItem('chief-custom', JSON.stringify(safe));
  emitStateEvent(CUSTOM_PROMPTS_UPDATED_EVENT);
}

export function writeStars(stars) {
  const safe = Array.isArray(stars) ? [...new Set(stars)] : [];
  localStorage.setItem('chief-stars', JSON.stringify(safe));
  emitStateEvent(STARRED_PROMPTS_UPDATED_EVENT);
}

export function createLocalPromptId(prefix = 'custom') {
  const suffix = globalThis.crypto?.randomUUID?.()
    || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${suffix}`;
}

export function normalizeCustomPrompts(prompts) {
  let changed = false;
  const normalized = (Array.isArray(prompts) ? prompts : [])
    .filter((prompt) => {
      const valid = prompt && typeof prompt === 'object' && !Array.isArray(prompt);
      if (!valid) changed = true;
      return valid;
    })
    .map((prompt) => {
      if (String(prompt.id ?? '').trim()) return prompt;
      changed = true;
      return { ...prompt, id: createLocalPromptId('custom') };
    });

  return { prompts: normalized, changed };
}

export function migrateLegacyCustomStarIds(customPrompts, stars) {
  let changed = false;
  const migrated = (Array.isArray(stars) ? stars : []).map((id) => {
    const match = /^c(\d+)$/.exec(String(id));
    if (!match) return id;
    const prompt = customPrompts[Number(match[1])];
    if (!prompt?.id) return id;
    changed = true;
    return prompt.id;
  });
  const deduped = [...new Set(migrated)];
  if (deduped.length !== migrated.length) changed = true;
  return { stars: deduped, changed };
}
