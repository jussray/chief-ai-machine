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

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

const LOCAL_PROMPT_ID_PATTERN = /^(?:(?:custom|freestyle|builder)-.+|c_?\d+)$/;

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeVersions(prompt) {
  const versions = {};
  let changed = false;

  if (isRecord(prompt.versions)) {
    for (const [provider, body] of Object.entries(prompt.versions)) {
      const key = String(provider).trim().toLowerCase();
      if (!key || typeof body !== 'string' || !body.trim()) {
        changed = true;
        continue;
      }
      if (key !== provider) changed = true;
      versions[key] = body;
    }
  } else if (prompt.versions != null) {
    changed = true;
  }

  if (!Object.keys(versions).length && typeof prompt.body === 'string' && prompt.body.trim()) {
    versions.chatgpt = prompt.body;
    changed = true;
  }

  return { versions, changed };
}

export function normalizeCustomPrompts(prompts, { reservedIds = [] } = {}) {
  let changed = false;
  const seenIds = new Set((Array.isArray(reservedIds) ? reservedIds : []).map(id => String(id)));
  const normalized = [];

  for (const prompt of Array.isArray(prompts) ? prompts : []) {
    if (!isRecord(prompt)) {
      changed = true;
      continue;
    }

    const normalizedVersions = normalizeVersions(prompt);
    if (!Object.keys(normalizedVersions.versions).length) {
      changed = true;
      continue;
    }
    if (normalizedVersions.changed) changed = true;

    const sourcePlatforms = Array.isArray(prompt.platforms)
      ? prompt.platforms
        .filter(platform => typeof platform === 'string')
        .map(platform => platform.trim().toLowerCase())
        .filter(Boolean)
      : [];
    if (Array.isArray(prompt.platforms)) {
      if (!sameStringArray(prompt.platforms, sourcePlatforms)) changed = true;
    } else if (prompt.platforms != null) {
      changed = true;
    }

    const platforms = [...new Set([
      ...sourcePlatforms,
      ...Object.keys(normalizedVersions.versions),
    ])];
    if (!sameStringArray(sourcePlatforms, platforms)) changed = true;

    let id = prompt.id == null ? '' : String(prompt.id).trim();
    if (!id || !LOCAL_PROMPT_ID_PATTERN.test(id) || seenIds.has(id)) {
      id = createLocalPromptId('custom');
      changed = true;
    } else if (typeof prompt.id !== 'string' || prompt.id !== id) {
      changed = true;
    }
    seenIds.add(id);

    const title = text(prompt.title).trim() || 'Untitled';
    const sub = text(prompt.sub);
    const cat = text(prompt.cat).trim().toLowerCase() || 'custom';
    const notes = text(prompt.notes);
    const emoji = text(prompt.emoji).trim() || '✨';

    if (title !== prompt.title || sub !== (prompt.sub ?? '') || cat !== prompt.cat || notes !== (prompt.notes ?? '') || emoji !== (prompt.emoji ?? '✨')) {
      changed = true;
    }

    normalized.push({
      ...prompt,
      id,
      title,
      sub,
      cat,
      notes,
      emoji,
      platforms,
      versions: normalizedVersions.versions,
    });
  }

  if (!Array.isArray(prompts) || normalized.length !== prompts.length) changed = true;
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
