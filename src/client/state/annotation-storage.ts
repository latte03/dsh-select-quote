/**
 * Environment probe for annotation persistence.
 *
 * Kept apart from `annotation-persistence.ts` because this is the only module
 * that reads `globalThis`: the pure layer stays importable in Node, where
 * verify-bundle replays the whole cycle against a Map-backed storage.
 *
 * The backend is plain localStorage — the same per-origin store the composer
 * draft lives in, under this plugin's own key prefix. Requiring the host's
 * `@deepseek-ai/dsh-client-store` instead would buy nothing: its persistence
 * backend is localStorage with the same key shape and the same whole-value
 * payload, while depending on a Harness Client package that the plugin spec
 * forbids loading as a module (it changes without notice, and a throwing
 * backend selection would take the whole slot entry down with it).
 */

import {
  createNoopPersistence,
  createStoragePersistence,
  type AnnotationPersistence,
  type KeyValueStorage,
} from './annotation-persistence.ts'

function browserStorage(): KeyValueStorage | null {
  try {
    const storage = globalThis.localStorage
    if (!storage) return null
    return {
      getItem: (key) => storage.getItem(key),
      setItem: (key, value) => storage.setItem(key, value),
      removeItem: (key) => storage.removeItem(key),
      keys: () => {
        const out: string[] = []
        for (let i = 0; i < storage.length; i += 1) {
          const key = storage.key(i)
          if (key !== null) out.push(key)
        }
        return out
      },
    }
  } catch {
    return null
  }
}

export function createAnnotationPersistence(): AnnotationPersistence {
  const storage = browserStorage()
  return storage ? createStoragePersistence(storage) : createNoopPersistence()
}
