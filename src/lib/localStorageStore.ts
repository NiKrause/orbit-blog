import { writable } from 'svelte/store';

function parseStoredJson(key: string, rawValue: string | null, initialValue: unknown) {
  if (rawValue === null) return initialValue;
  try {
    return JSON.parse(rawValue);
  } catch {
    localStorage.removeItem(key);
    return initialValue;
  }
}

export function localStorageStore<T>(key: string, initialValue: T) {
  const storedValue = localStorage.getItem(key);
  const store = writable<T>(parseStoredJson(key, storedValue, initialValue) as T);

  store.subscribe(value => {
    localStorage.setItem(key, JSON.stringify(value));
  });

  return store;
}
