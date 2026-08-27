import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// jsdom under vitest does not expose localStorage, so provide a minimal
// in-memory implementation for the tests that exercise mode persistence.
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const memoryStorage: Storage = {
    get length() {
      return store.size
    },
    key: (index) => [...store.keys()][index] ?? null,
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
  }
  Object.defineProperty(globalThis, 'localStorage', {
    value: memoryStorage,
    configurable: true,
  })
}

afterEach(() => {
  cleanup()
})
