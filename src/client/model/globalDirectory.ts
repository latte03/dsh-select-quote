/**
 * Model directory face over the Host-generation catalog.
 *
 * The settings page has no session, so it cannot use `modelDirectories`. This
 * adapter feeds the same `ModelSelect` from the catalog the Host already
 * shares with every session selector.
 */

import type { ModelCatalogSnapshot, ModelDirectoryFace, ModelGroup } from './types.ts'

export function createGlobalModelDirectory(
  read: () => Promise<readonly ModelGroup[]>,
): ModelDirectoryFace {
  let snapshot: ModelCatalogSnapshot = {
    current: null,
    groups: [],
    failures: [],
    status: 'idle',
    pending: null,
    error: null,
  }
  let inflight: Promise<unknown> | undefined
  const listeners = new Set<() => void>()

  const publish = (next: ModelCatalogSnapshot): void => {
    snapshot = next
    for (const listener of [...listeners]) listener()
  }

  return {
    store: {
      getSnapshot: () => snapshot,
      subscribe(listener) {
        listeners.add(listener)
        return () => {
          listeners.delete(listener)
        }
      },
    },
    load() {
      if (snapshot.status === 'ready') return Promise.resolve(snapshot.groups)
      if (inflight !== undefined) return inflight
      publish({ ...snapshot, status: 'loading', error: null })
      const operation = Promise.resolve()
        .then(read)
        .then(
          (groups) => {
            publish({ ...snapshot, groups, status: 'ready', error: null })
            return groups
          },
          (error: unknown) => {
            const message = error instanceof Error ? error.message : String(error)
            publish({ ...snapshot, status: 'error', error: message })
            throw error
          },
        )
        .finally(() => {
          if (inflight === operation) inflight = undefined
        })
      inflight = operation
      return operation
    },
  }
}
