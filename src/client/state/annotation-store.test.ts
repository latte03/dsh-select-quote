import { describe, expect, it, vi } from 'vitest'
import { createStoragePersistence, type KeyValueStorage } from './annotation-persistence.ts'

/**
 * The store is a module singleton keyed by session, so every case loads its
 * own instance over a private storage map: `vi.resetModules()` is the reload
 * (fresh in-memory partitions, same bytes underneath).
 */
type Store = typeof import('./annotation-store.ts')

async function freshStore(storage: KeyValueStorage): Promise<Store> {
  vi.resetModules()
  const store = await import('./annotation-store.ts')
  store.setAnnotationPersistence(createStoragePersistence(storage))
  return store
}

/** A macrotask tick: queued microtasks (bind adoption) have certainly run. */
const flush = () => new Promise<void>((done) => setTimeout(done, 0))

function memoryStorage(): KeyValueStorage {
  const map = new Map<string, string>()
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    keys: () => [...map.keys()],
  }
}

describe('bindAnnotationSession', () => {
  it('switches the partition synchronously and adopts stored items on the microtask', async () => {
    const storage = memoryStorage()
    const seeder = await freshStore(storage)
    seeder.bindAnnotationSession('session-original')
    await flush()
    seeder.saveAnnotation(undefined, { text: '划中的原文', sources: [{ text: '划中的原文' }] })

    // Reload: empty memory, same storage — the bind must surface the item.
    const store = await freshStore(storage)
    store.bindAnnotationSession('session-original')
    expect(store.getAnnotations().length).toBe(0)
    await flush()
    expect(store.getAnnotations().length).toBe(1)
    expect(store.getAnnotations()[0]?.text).toBe('划中的原文')
  })

  it('republishes exactly once when a rebind adopts stored annotations', async () => {
    const storage = memoryStorage()
    const seeder = await freshStore(storage)
    seeder.bindAnnotationSession('session-original')
    await flush()
    seeder.saveAnnotation(undefined, { text: '待发的划词', sources: [{ text: '待发的划词' }] })

    const store = await freshStore(storage)
    const seen: number[] = []
    store.subscribeAnnotations(() => seen.push(store.getAnnotations().length))
    store.bindAnnotationSession('session-original')
    await flush()
    expect(seen).toEqual([1])
  })

  it('republishes on a rebind to a fresh session, dropping the old partition from view', async () => {
    const storage = memoryStorage()
    const store = await freshStore(storage)
    store.bindAnnotationSession('session-original')
    await flush()
    store.saveAnnotation(undefined, { text: '待发的划词', sources: [{ text: '待发的划词' }] })

    const seen: number[] = []
    const unsubscribe = store.subscribeAnnotations(() => seen.push(store.getAnnotations().length))

    // Fork: the host mints a brand-new session id with nothing stored under it.
    // Adoption has nothing to do, but the active partition moved, so
    // subscribers (the pending-mark job sync) must still re-read it —
    // otherwise the previous session's marks bleed into the forked transcript
    // while the composer card is already gone.
    store.bindAnnotationSession('session-fork')
    await flush()
    expect(seen).toEqual([0])
    expect(store.getAnnotations().length).toBe(0)

    // The forked session only parks the old partition; switching back
    // restores card and marks together, with no data loss.
    expect(store.getAnnotations('session-original').length).toBe(1)
    unsubscribe()
  })

  it('restores the previous session on a rebind back in one publication', async () => {
    const storage = memoryStorage()
    const store = await freshStore(storage)
    store.bindAnnotationSession('session-original')
    await flush()
    store.saveAnnotation(undefined, { text: '待发的划词', sources: [{ text: '待发的划词' }] })
    store.bindAnnotationSession('session-fork')
    await flush()

    const seen: number[] = []
    const unsubscribe = store.subscribeAnnotations(() => seen.push(store.getAnnotations().length))
    store.bindAnnotationSession('session-original')
    await flush()
    expect(seen).toEqual([1])
    expect(store.getAnnotations().length).toBe(1)
    expect(store.getAnnotations()[0]?.text).toBe('待发的划词')
    unsubscribe()
  })

  it('adopts only the last session when two binds land in the same tick', async () => {
    const storage = memoryStorage()
    const seeder = await freshStore(storage)
    seeder.bindAnnotationSession('session-a')
    await flush()
    seeder.saveAnnotation(undefined, { text: 'A 的批注', sources: [{ text: 'A 的批注' }] })
    seeder.bindAnnotationSession('session-b')
    await flush()
    seeder.saveAnnotation(undefined, { text: 'B 的批注', sources: [{ text: 'B 的批注' }] })

    const store = await freshStore(storage)
    const seen: number[] = []
    const unsubscribe = store.subscribeAnnotations(() => seen.push(store.getAnnotations().length))
    store.bindAnnotationSession('session-a')
    store.bindAnnotationSession('session-b')
    await flush()
    // The superseded bind must not adopt/publish its partition; only the
    // active session's adoption is surfaced, exactly once.
    expect(seen).toEqual([1])
    expect(store.getAnnotations().map((item) => item.text)).toEqual(['B 的批注'])

    // Skipping the superseded bind is not data loss: its storage is untouched.
    store.bindAnnotationSession('session-a')
    await flush()
    expect(store.getAnnotations().map((item) => item.text)).toEqual(['A 的批注'])
    unsubscribe()
  })
})
