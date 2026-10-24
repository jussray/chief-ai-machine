export const LOCAL_FIRST_OUTBOX_KEY = 'chief-local-first-outbox-v1';
export const LOCAL_FIRST_OUTBOX_VERSION = 1;

const MAX_OUTBOX_ITEMS = 100;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function createMutationId(randomUUID = globalThis.crypto?.randomUUID?.bind(globalThis.crypto)) {
  if (typeof randomUUID === 'function') return randomUUID();
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseOutbox(raw) {
  if (raw == null) return [];
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Local-first outbox is not an array');
  return parsed.filter(entry => (
    isRecord(entry)
    && typeof entry.id === 'string'
    && typeof entry.storageKey === 'string'
    && typeof entry.scope === 'string'
    && entry.version === LOCAL_FIRST_OUTBOX_VERSION
  ));
}

export function readLocalFirstOutbox(storage = globalThis.localStorage, outboxKey = LOCAL_FIRST_OUTBOX_KEY) {
  try {
    return parseOutbox(storage?.getItem?.(outboxKey));
  } catch {
    return [];
  }
}

export function commitLocalFirstValue(storage, {
  storageKey,
  value,
  scope = 'user-state',
  outboxKey = LOCAL_FIRST_OUTBOX_KEY,
  now = () => Date.now(),
  randomUUID,
} = {}) {
  if (!storage?.setItem || !storage?.getItem) throw new Error('Local storage is unavailable');
  if (typeof storageKey !== 'string' || !storageKey) throw new Error('storageKey is required');

  const serialized = JSON.stringify(value);

  // Local state is the primary write. If this fails, the mutation did not happen.
  storage.setItem(storageKey, serialized);

  const mutation = {
    version: LOCAL_FIRST_OUTBOX_VERSION,
    id: createMutationId(randomUUID),
    storageKey,
    scope,
    operation: 'replace',
    payload: JSON.parse(serialized),
    createdAt: Number(now()),
  };

  // Sync bookkeeping is secondary. A queue failure must never roll back a
  // successful local write or make the app unusable offline.
  try {
    const previous = parseOutbox(storage.getItem(outboxKey));
    const compacted = previous
      .filter(entry => entry.storageKey !== storageKey)
      .slice(-(MAX_OUTBOX_ITEMS - 1));
    storage.setItem(outboxKey, JSON.stringify([...compacted, mutation]));
    return { localCommitted: true, syncQueued: true, mutationId: mutation.id };
  } catch {
    return { localCommitted: true, syncQueued: false, mutationId: mutation.id };
  }
}

export function acknowledgeLocalFirstMutation(storage, mutationId, outboxKey = LOCAL_FIRST_OUTBOX_KEY) {
  if (!storage?.setItem || !storage?.getItem || typeof mutationId !== 'string' || !mutationId) return false;
  try {
    const previous = parseOutbox(storage.getItem(outboxKey));
    const next = previous.filter(entry => entry.id !== mutationId);
    if (next.length === previous.length) return false;
    storage.setItem(outboxKey, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
