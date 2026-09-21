import { describe, expect, test } from 'vitest';
import {
  LOCAL_FIRST_OUTBOX_KEY,
  acknowledgeLocalFirstMutation,
  commitLocalFirstValue,
  readLocalFirstOutbox,
} from './local-first.js';

class MemoryStorage {
  constructor({ failOn = null } = {}) {
    this.values = new Map();
    this.failOn = failOn;
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null;
  }

  setItem(key, value) {
    if (key === this.failOn) throw new Error(`blocked write: ${key}`);
    this.values.set(key, String(value));
  }
}

describe('local-first write contract', () => {
  test('commits user state before queueing remote sync work', () => {
    const storage = new MemoryStorage();
    const result = commitLocalFirstValue(storage, {
      storageKey: 'chief-custom',
      value: [{ id: 'local-1', title: 'Offline draft' }],
      now: () => 123,
      randomUUID: () => 'mutation-1',
    });

    expect(result).toEqual({ localCommitted: true, syncQueued: true, mutationId: 'mutation-1' });
    expect(JSON.parse(storage.getItem('chief-custom'))).toEqual([{ id: 'local-1', title: 'Offline draft' }]);
    expect(readLocalFirstOutbox(storage)).toEqual([{
      version: 1,
      id: 'mutation-1',
      storageKey: 'chief-custom',
      scope: 'user-state',
      operation: 'replace',
      payload: [{ id: 'local-1', title: 'Offline draft' }],
      createdAt: 123,
    }]);
  });

  test('keeps the successful local write when sync bookkeeping is unavailable', () => {
    const storage = new MemoryStorage({ failOn: LOCAL_FIRST_OUTBOX_KEY });
    const result = commitLocalFirstValue(storage, {
      storageKey: 'chief-stars',
      value: ['local-star'],
      randomUUID: () => 'mutation-2',
    });

    expect(result.localCommitted).toBe(true);
    expect(result.syncQueued).toBe(false);
    expect(JSON.parse(storage.getItem('chief-stars'))).toEqual(['local-star']);
  });

  test('compacts repeated state replacements to the newest pending snapshot', () => {
    const storage = new MemoryStorage();
    commitLocalFirstValue(storage, {
      storageKey: 'chief-custom',
      value: [{ id: 'v1' }],
      now: () => 1,
      randomUUID: () => 'mutation-1',
    });
    commitLocalFirstValue(storage, {
      storageKey: 'chief-custom',
      value: [{ id: 'v2' }],
      now: () => 2,
      randomUUID: () => 'mutation-2',
    });

    expect(readLocalFirstOutbox(storage)).toEqual([expect.objectContaining({
      id: 'mutation-2',
      storageKey: 'chief-custom',
      payload: [{ id: 'v2' }],
      createdAt: 2,
    })]);
  });

  test('removes only the acknowledged mutation after remote receipt', () => {
    const storage = new MemoryStorage();
    commitLocalFirstValue(storage, {
      storageKey: 'chief-custom',
      value: [{ id: 'draft' }],
      randomUUID: () => 'mutation-custom',
    });
    commitLocalFirstValue(storage, {
      storageKey: 'chief-stars',
      value: ['draft'],
      randomUUID: () => 'mutation-stars',
    });

    expect(acknowledgeLocalFirstMutation(storage, 'mutation-custom')).toBe(true);
    expect(readLocalFirstOutbox(storage)).toEqual([expect.objectContaining({ id: 'mutation-stars' })]);
  });
});
