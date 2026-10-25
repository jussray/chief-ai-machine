import { commitLocalFirstValue } from './local-first.js';

export const CUSTOM_PROMPTS_UPDATED_EVENT = 'chief-custom-updated';
export const STARRED_PROMPTS_UPDATED_EVENT = 'chief-stars-updated';
export const PROMPT_STAR_MIGRATION_JOURNAL = 'chief-prompt-star-migration-v1';

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
  if (!resumePendingPromptStarMigration()) throw new Error('Pending prompt/star migration is not recoverable');
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
  if (!resumePendingPromptStarMigration()) throw new Error('Pending prompt/star migration is not recoverable');
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

// LocalStorage has no atomic multi-key transaction. The journal is committed
// *before* either write, and replayed at the next read if an operation fails.
export function resumePendingPromptStarMigration() {
  let raw;
  try {
    raw = localStorage.getItem(PROMPT_STAR_MIGRATION_JOURNAL);
    if (raw === null) return true;
    const pending = JSON.parse(raw);
    if (!pending || pending.version !== 1
      || !Array.isArray(pending.prompts) || !Array.isArray(pending.stars)) return false;
    const normalized = normalizeCustomPrompts(pending.prompts);
    if (normalized.changed || normalized.prompts.length !== pending.prompts.length) return false;
    if (pending.stars.some(star => !(
      (typeof star === 'string' && star.length > 0 && star.length <= 180)
      || (typeof star === 'number' && Number.isSafeInteger(star))
    ))) return false;

    commitLocalFirstValue(localStorage, {
      storageKey: 'chief-custom', scope: 'custom-prompts', value: pending.prompts,
    });
    commitLocalFirstValue(localStorage, {
      storageKey: 'chief-stars', scope: 'starred-prompts', value: [...new Set(pending.stars)],
    });
    localStorage.removeItem(PROMPT_STAR_MIGRATION_JOURNAL);
    return true;
  } catch {
    // Retain the journal and fail closed instead of claiming an empty dataset.
    return false;
  }
}

export function writeRecoverablePromptAndStarState(prompts, stars, { emit = true } = {}) {
  if (!resumePendingPromptStarMigration()) throw new Error('Pending prompt/star migration is not recoverable');
  const normalized = normalizeCustomPrompts(prompts);
  if (!Array.isArray(prompts) || normalized.changed || normalized.prompts.length !== prompts.length) {
    throw new Error('Prompt/star migration requires canonical prompts');
  }
  if (!Array.isArray(stars) || stars.some(star => !(
    (typeof star === 'string' && star.length > 0 && star.length <= 180)
    || (typeof star === 'number' && Number.isSafeInteger(star))
  ))) throw new Error('Prompt/star migration requires valid stars');

  localStorage.setItem(PROMPT_STAR_MIGRATION_JOURNAL, JSON.stringify({
    version: 1, prompts: normalized.prompts, stars: [...new Set(stars)],
  }));
  if (!resumePendingPromptStarMigration()) throw new Error('Prompt/star migration interrupted; journal retained');
  if (emit) {
    emitStateEvent(CUSTOM_PROMPTS_UPDATED_EVENT);
    emitStateEvent(STARRED_PROMPTS_UPDATED_EVENT);
  }
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
  const sourcePairs = [];

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

    const sourceId = prompt.id == null ? '' : String(prompt.id).trim();
    let id = normalizePromptId(prompt.id);
    if (!id || seenIds.has(id)) {
      id = createLocalPromptId('custom');
      changed = true;
    } else if (prompt.id !== id) {
      changed = true;
    }
    seenIds.add(id);
    if (sourceId) sourcePairs.push([sourceId, id]);

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

  const sourceCounts = new Map();
  sourcePairs.forEach(([sourceId]) => sourceCounts.set(sourceId, (sourceCounts.get(sourceId) || 0) + 1));
  const ambiguousIds = [...sourceCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([sourceId]) => sourceId);
  const idRemap = sourcePairs
    .filter(([sourceId, finalId]) => sourceCounts.get(sourceId) === 1 && sourceId !== finalId)
    .map(([from, to]) => ({ from, to }));

  return { prompts: normalized, changed, idRemap, ambiguousIds };
}

export function remapStarReferences(stars, idRemap = [], ambiguousIds = []) {
  const remap = new Map((Array.isArray(idRemap) ? idRemap : [])
    .filter(entry => isRecord(entry) && typeof entry.from === 'string' && typeof entry.to === 'string')
    .map(entry => [entry.from, entry.to]));
  const ambiguous = new Set((Array.isArray(ambiguousIds) ? ambiguousIds : [])
    .filter(value => typeof value === 'string'));
  let changed = false;
  const next = [];

  for (const star of Array.isArray(stars) ? stars : []) {
    if (typeof star !== 'string') {
      next.push(star);
      continue;
    }
    const key = star.trim();
    if (ambiguous.has(key)) {
      changed = true;
      continue;
    }
    const mapped = remap.get(key);
    if (mapped) {
      if (mapped !== star) changed = true;
      next.push(mapped);
      continue;
    }
    next.push(star);
  }

  const deduped = [...new Set(next)];
  if (deduped.length !== next.length) changed = true;
  return { stars: deduped, changed };
}

export function readCustomPromptState({ reservedIds } = {}) {
  if (!resumePendingPromptStarMigration()) {
    return { state: 'unavailable', prompts: [], idRemap: [], ambiguousIds: [] };
  }
  if (!Array.isArray(reservedIds)) {
    throw new Error('readCustomPromptState requires reservedIds array to prevent prompt ID collisions');
  }
  const read = readStoredArrayState('chief-custom');
  if (read.state !== 'ready') return { state: read.state, prompts: [], idRemap: [], ambiguousIds: [] };

  const normalized = normalizeCustomPrompts(read.values, { reservedIds });
  if (normalized.prompts.length !== read.values.length) {
    return { state: 'corrupt', prompts: [], idRemap: [], ambiguousIds: [] };
  }

  if (normalized.changed) {
    try {
      if (normalized.idRemap.length || normalized.ambiguousIds.length) {
        const starState = readStarState();
        if (starState.state !== 'ready') {
          return { state: 'unavailable', prompts: [], idRemap: [], ambiguousIds: [] };
        }
        const migrated = remapStarReferences(
          starState.stars, normalized.idRemap, normalized.ambiguousIds,
        );
        // Save both keys through one recoverable journal, before either ID
        // migration can become permanent or a star can point to a public ID.
        writeRecoverablePromptAndStarState(normalized.prompts, migrated.stars, { emit: false });
      } else {
        commitLocalFirstValue(localStorage, {
          storageKey: 'chief-custom', scope: 'custom-prompts', value: normalized.prompts,
        });
      }
    } catch {
      return { state: 'unavailable', prompts: [], idRemap: [], ambiguousIds: [] };
    }
  }
  return {
    state: 'ready',
    prompts: normalized.prompts,
    idRemap: [],
    ambiguousIds: [],
  };
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
