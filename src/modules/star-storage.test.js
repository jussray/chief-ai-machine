import { beforeEach, describe, expect, it } from 'vitest';
import { readStarStorage, writeStarStorage } from './star-storage.js';
import { setupLocalStorageTest } from '../../test/fixtures/storage.js';

let store;

beforeEach(() => {
  const setup = setupLocalStorageTest();
  store = setup.store;
  globalThis.localStorage = setup.localStorage;
});

describe('star storage truth boundary', () => {
  it('treats absent storage as verified empty', () => {
    expect(readStarStorage()).toEqual({ state: 'ready', stars: [] });
  });

  it.each([
    ['{"private":"unterminated"', 'malformed JSON'],
    ['{"not":"an-array"}', 'non-array state'],
    [JSON.stringify([1, { injected: true }]), 'non-reference entry'],
    [JSON.stringify(['same', 'same']), 'duplicate state'],
  ])('fails closed on %s (%s)', (raw) => {
    store.set('chief-stars', raw);
    expect(readStarStorage()).toEqual({ state: 'corrupt', stars: [] });
    expect(store.get('chief-stars')).toBe(raw);
  });

  it('accepts the canonical number/string references used by the app', () => {
    store.set('chief-stars', JSON.stringify([1, 'custom-1']));
    expect(readStarStorage()).toEqual({ state: 'ready', stars: [1, 'custom-1'] });
  });

  it('writes canonical state without silently repairing unknown data', () => {
    writeStarStorage(['custom-2']);
    expect(store.get('chief-stars')).toBe('["custom-2"]');
  });
});
