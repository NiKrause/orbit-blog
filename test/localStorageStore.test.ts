import { expect } from 'chai';
import { get } from 'svelte/store';
import { localStorageStore } from '../src/lib/utils.js';

class MockLocalStorage {
  store = new Map<string, string>();

  getItem(key: string) {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, String(value));
  }

  removeItem(key: string) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

describe('localStorageStore', () => {
  const originalLocalStorage = globalThis.localStorage;
  let mockLocalStorage: MockLocalStorage;

  beforeEach(() => {
    mockLocalStorage = new MockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: mockLocalStorage,
    });
  });

  afterEach(() => {
    if (originalLocalStorage === undefined) {
      delete (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage;
    } else {
      Object.defineProperty(globalThis, 'localStorage', {
        configurable: true,
        value: originalLocalStorage,
      });
    }
  });

  it('falls back to the initial value when stored JSON is truncated', () => {
    mockLocalStorage.setItem('showPeers', '{"broken":');

    const store = localStorageStore('showPeers', false);

    expect(get(store)).to.equal(false);
    expect(mockLocalStorage.getItem('showPeers')).to.equal('false');
  });

  it('restores valid JSON from localStorage', () => {
    mockLocalStorage.setItem('showPeers', 'true');

    const store = localStorageStore('showPeers', false);

    expect(get(store)).to.equal(true);
  });
});
