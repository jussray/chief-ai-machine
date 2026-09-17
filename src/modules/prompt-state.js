export const CUSTOM_PROMPTS_UPDATED_EVENT = 'chief-custom-updated';
export const STARRED_PROMPTS_UPDATED_EVENT = 'chief-stars-updated';

export function readStoredArrayState(key) {
  let raw;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return { state: 'unavailable', values: [] };
  }
  if (raw === null) return { state: 'ready', values: [] };

  try {
    const value = JSON.parse(raw);
    return Array.isArray(value)
      ? { state: 'ready', values: value }
      : { state: 'corrupt', values: [] };
  } catch {
    return { state: 'corrupt', values: [] };
  }
}

export function readStoredArray(key) {
  const read = readStoredArrayState(key);
  return read.state === 'ready' ? read.values : [];
}

function emitStateEvent(name) {
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  window.dispatchEvent(new window.Event(name));
}

export function writeCustomPrompts(prompts) {
  const safe = normalizeCustomPrompts(Array.isArray(prompts) ? prompts : []).prompts;
  localStorage.setItem('chief-custom', JSON.stringify(safe));
  emitStateEvent(CUSTOM_PROMPTS_UPDATED_EVENT);
}

export function writeStars(stars) {
  const safe = Array.isArray(stars)
    ? [...new Set(stars.filter(value => (
      (typeof value === 'string' && value.length > 0 && value.length <= 180)
      || (typeof value === 'number' && Number.isSafeInteger(value))
    )))]
    : [];
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

function normalizePromptId(value) {
  if (typeof value !== 'string') return '';
  const id = value.trim();
  return id && id.length <= 180 ? id : '';
}

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeStringArray(value, { lowercase = false } = {}) {
  if (!Array.isArray(value)) return [];
  return value
    .filter(item => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => lowercase ? item.toLowerCase() : item);
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

    const sourcePlatforms = normalizeStringArray(prompt.platforms, { lowercase: true });
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

    const sourceRepos = normalizeStringArray(prompt.repos, { lowercase: true });
    const repos = [...new Set(sourceRepos)];
    if (Array.isArray(prompt.repos)) {
      if (!sameStringArray(prompt.repos, repos)) changed = true;
    } else if (prompt.repos != null) {
      changed = true;
    }

    let id = normalizePromptId(prompt.id);
    if (!id || seenIds.has(id)) {
      id = createLocalPromptId('custom');
      changed = true;
    } else if (prompt.id !== id) {
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

    const canonical = {
      id,
      title,
      sub,
      cat,
      notes,
      emoji,
      platforms,
      versions: normalizedVersions.versions,
      repos,
    };

    const canonicalKeys = Object.keys(canonical).sort();
    const sourceKeys = Object.keys(prompt).sort();
    if (canonicalKeys.length !== sourceKeys.length || canonicalKeys.some((key, index) => key !== sourceKeys[index])) {
      changed = true;
    }

    normalized.push(canonical);
  }

  if (!Array.isArray(prompts) || normalized.length !== prompts.length) changed = true;
  return { prompts: normalized, changed };
}

export function readCustomPromptState() {
  const read = readStoredArrayState('chief-custom');
  if (read.state !== 'ready') return { state: read.state, prompts: [] };

  const normalized = normalizeCustomPrompts(read.values);
  if (normalized.prompts.length !== read.values.length) {
    return { state: 'corrupt', prompts: [] };
  }

  if (normalized.changed) {
    try {
      localStorage.setItem('chief-custom', JSON.stringify(normalized.prompts));
    } catch {
      return { state: 'unavailable', prompts: [] };
    }
  }
  return { state: 'ready', prompts: normalized.prompts };
}

export function readStarState() {
  const read = readStoredArrayState('chief-stars');
  if (read.state !== 'ready') return { state: read.state, stars: [] };

  const valid = read.values.filter(value => (
    (typeof value === 'string' && value.length > 0 && value.length <= 180)
    || (typeof value === 'number' && Number.isSafeInteger(value))
  ));
  if (valid.length !== read.values.length) return { state: 'corrupt', stars: [] };
  return { state: 'ready', stars: [...new Set(valid)] };
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
