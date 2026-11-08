/**
 * Shared test storage fixtures to eliminate duplication across test suites.
 * Consolidates localStorage mocks and in-memory storage implementations.
 */

/**
 * MemoryStorage class for testing localStorage-dependent code.
 * Supports error injection via failOn key for resilience testing.
 */
export class MemoryStorage {
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

  removeItem(key) {
    this.values.delete(key);
  }

  clear() {
    this.values.clear();
  }
}

/**
 * Mock localStorage for testing without browser globals.
 * Reduces ~18 lines of duplicate setup code per test file.
 */
export function createMockLocalStorage(store = new Map()) {
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

/**
 * Setup helper for tests using localStorage.
 * Returns both the store and the mock, ready to assign to globalThis.localStorage.
 */
export function setupLocalStorageTest() {
  const store = new Map();
  const localStorage = createMockLocalStorage(store);
  return { store, localStorage };
}
