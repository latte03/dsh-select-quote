/**
 * Backend selection for annotation persistence.
 *
 * Kept apart from `annotation-persistence.ts` because reaching the host's
 * client-store needs a guarded `require`, and that is the one thing the pure
 * module cannot do — verify-bundle imports the pure module straight into Node,
 * where a `declare` statement is not valid JavaScript.
 *
 * Preference order: the host store (same engine and keying as the composer
 * draft), plain localStorage, and a no-op when the environment has no storage
 * at all.
 */

import {
  createHostStorePersistence,
  createNoopPersistence,
  createStoragePersistence,
  type AnnotationPersistence,
  type DefineStoreLike,
  type KeyValueStorage,
} from './annotation-persistence.ts'

/** The host package is a platform seed word; older hosts may not carry it. */
const HOST_STORE_MODULE = '@deepseek-ai/dsh-client-store'

// The bundle is CJS and every factory receives the loader's `require`; a
// missing seed word throws there, which is exactly the signal to fall back.
declare const require: (name: string) => unknown

function hostDefineStore(): DefineStoreLike | null {
  try {
    const loaded = require(HOST_STORE_MODULE) as { defineStore?: unknown } | null
    return typeof loaded?.defineStore === 'function' ? (loaded.defineStore as DefineStoreLike) : null
  } catch {
    return null
  }
}

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
  const defineStore = hostDefineStore()
  if (storage && defineStore) return createHostStorePersistence(defineStore, storage)
  if (storage) return createStoragePersistence(storage)
  return createNoopPersistence()
}
