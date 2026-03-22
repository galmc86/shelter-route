import '@testing-library/jest-dom'

// Node.js 22+ ships a built-in localStorage on globalThis that lacks standard
// methods like clear(). When vitest uses jsdom, jsdom sets a full localStorage
// on `window`, but the incomplete Node built-in on globalThis takes precedence
// when tests reference the bare `localStorage` identifier. Fix by replacing
// globalThis.localStorage with a proper Storage implementation.
const store: Record<string, string> = {};
const localStorageMock: Storage = {
  getItem(key: string): string | null {
    return key in store ? store[key] : null;
  },
  setItem(key: string, value: string): void {
    store[key] = String(value);
  },
  removeItem(key: string): void {
    delete store[key];
  },
  clear(): void {
    for (const key of Object.keys(store)) {
      delete store[key];
    }
  },
  key(index: number): string | null {
    const keys = Object.keys(store);
    return keys[index] ?? null;
  },
  get length(): number {
    return Object.keys(store).length;
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  writable: true,
  configurable: true,
});
