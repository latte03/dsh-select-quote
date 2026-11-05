import { describe, expect, it, vi } from 'vitest'
import {
  createStoragePersistence,
  keyForSession,
  pruneSessions,
  type KeyValueStorage,
} from './annotation-persistence.ts'
import { handoffMarkId, selectionKeyOf } from './handoff.ts'

type Store = typeof import('./annotation-store.ts')

async function freshStore(storage: KeyValueStorage): Promise<Store> {
  vi.resetModules()
  const store = await import('./annotation-store.ts')
  store.setAnnotationPersistence(createStoragePersistence(storage))
  return store
}

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

const snapshot = {
  text: '同一段原文',
  left: 0,
  top: 0,
  below: false,
  selectionBottom: 0,
  layer: {} as never,
  source: { text: '同一段原文', messageId: 'flow-1', startOffset: 4, endOffset: 10 },
}

function put(store: Store, target: string, comment = '') {
  return store.saveHandoff('source', {
    text: snapshot.text,
    comment,
    sources: [snapshot.source],
    origin: { sessionId: 'source', title: 'Source' },
    destination: { sessionId: target, kind: 'existing', title: target },
  })
}

describe('handoff writes', () => {
  it('writes the target pending item first and the source outbound record', async () => {
    const store = await freshStore(memoryStorage())
    const result = put(store, 'target')
    expect(result.persisted).toBe(true)
    expect(result.outbound.state).toBe('pending')

    const [item] = store.getAnnotations('target')
    expect(item?.text).toBe('同一段原文')
    expect(item?.origin).toEqual({
      sessionId: 'source',
      title: 'Source',
      handoffId: result.outbound.id,
    })
    const [record] = store.getOutbound('source')
    expect(record?.destination.sessionId).toBe('target')
    expect(record?.selectionKey).toBe(selectionKeyOf(snapshot.text, snapshot.source))
  })

  it('dedupes a repeated put into the same target', async () => {
    const store = await freshStore(memoryStorage())
    const first = put(store, 'target', '旧评论')
    const second = put(store, 'target', '新评论')
    expect(second.reused).toBe(true)
    expect(second.outbound.id).toBe(first.outbound.id)
    expect(store.getAnnotations('target')).toHaveLength(1)
    expect(store.getOutbound('source')).toHaveLength(1)
    expect(store.getAnnotations('target')[0]?.comment).toBe('新评论')
    expect(store.getOutbound('source')[0]?.comment).toBe('新评论')
  })

  it('shares one selection key and mark id across targets', async () => {
    const store = await freshStore(memoryStorage())
    put(store, 'target-a')
    put(store, 'target-b')
    const records = store.getOutbound('source')
    expect(records).toHaveLength(2)
    expect(new Set(records.map((record) => record.selectionKey)).size).toBe(1)
    const groups = store.outboundGroups('source')
    expect(groups).toHaveLength(1)
    expect(groups[0]?.markId).toBe(handoffMarkId(records[0]!.selectionKey))
    expect(groups[0]?.records).toHaveLength(2)
  })

  it('keeps the mark while another target remains after a removal', async () => {
    const store = await freshStore(memoryStorage())
    put(store, 'target-a')
    put(store, 'target-b')
    const item = store.getAnnotations('target-a')[0]!
    store.removeAnnotation('target-a', item.id)
    expect(store.getAnnotations('target-a')).toHaveLength(0)
    expect(store.getOutbound('source')).toHaveLength(1)
    expect(store.outboundGroups('source')).toHaveLength(1)
    store.removeAnnotation('target-b', store.getAnnotations('target-b')[0]!.id)
    expect(store.outboundGroups('source')).toHaveLength(0)
  })
})

describe('handoff synchronization', () => {
  it('syncs an edited comment to the source record', async () => {
    const store = await freshStore(memoryStorage())
    const result = put(store, 'target', 'before')
    store.updateAnnotationComment('target', result.item.id, 'after')
    expect(store.getOutbound('source')[0]?.comment).toBe('after')
  })

  it('clears with reason sent: source stays and flips to sent', async () => {
    const store = await freshStore(memoryStorage())
    const result = put(store, 'target')
    store.clearAnnotations('target', 'sent')
    expect(store.getAnnotations('target')).toHaveLength(0)
    expect(store.getOutbound('source')[0]?.state).toBe('sent')
    expect(store.reconcileHandoffs()).toBe(false)
    expect(result.outbound.id).toBe(store.getOutbound('source')[0]?.id)
  })

  it('clears with reason discarded: the paired source record goes too', async () => {
    const store = await freshStore(memoryStorage())
    put(store, 'target')
    store.clearAnnotations('target', 'discarded')
    expect(store.getAnnotations('target')).toHaveLength(0)
    expect(store.getOutbound('source')).toHaveLength(0)
  })

  it('restores a rewind with origin/handoffId and flips sent back to pending', async () => {
    const store = await freshStore(memoryStorage())
    const result = put(store, 'target', '保留的评论')
    store.clearAnnotations('target', 'sent')
    store.restoreAnnotations('target', [
      {
        text: result.item.text,
        comment: result.item.comment ?? '',
        sources: result.item.sources,
        origin: result.item.origin!,
      },
    ])
    const restored = store.getAnnotations('target')[0]!
    expect(restored.origin).toEqual(result.item.origin)
    expect(store.getOutbound('source')[0]?.state).toBe('pending')
    // A repeated restore is idempotent.
    store.restoreAnnotations('target', [
      {
        text: result.item.text,
        comment: result.item.comment ?? '',
        sources: result.item.sources,
        origin: result.item.origin!,
      },
    ])
    expect(store.getAnnotations('target')).toHaveLength(1)
  })
})

describe('reconciliation and retention', () => {
  it('removes a pending outbound whose target item disappeared', async () => {
    const storage = memoryStorage()
    const store = await freshStore(storage)
    put(store, 'target')
    // Simulate a half-write: the target key loses the item.
    const targetRaw = JSON.parse(storage.getItem(keyForSession('target'))!)
    storage.setItem(
      keyForSession('target'),
      JSON.stringify({ ...targetRaw, items: [], updatedAt: Date.now() }),
    )
    const reloaded = await freshStore(storage)
    reloaded.bindAnnotationSession('source')
    await flush()
    expect(reloaded.getOutbound('source')).toHaveLength(0)
  })

  it('removes a target item whose source record disappeared', async () => {
    const storage = memoryStorage()
    const store = await freshStore(storage)
    put(store, 'target')
    const sourceRaw = JSON.parse(storage.getItem(keyForSession('source'))!)
    storage.setItem(
      keyForSession('source'),
      JSON.stringify({ ...sourceRaw, outbound: [], updatedAt: Date.now() }),
    )
    const reloaded = await freshStore(storage)
    reloaded.bindAnnotationSession('target')
    await flush()
    expect(reloaded.getAnnotations('target')).toHaveLength(0)
  })

  it('keeps a sent outbound key beyond the session window', async () => {
    const storage = memoryStorage()
    const store = await freshStore(storage)
    put(store, 'target')
    store.markHandoffSent('source', store.getOutbound('source')[0]!.id)
    store.clearAnnotations('target', 'sent')
    const stale = Date.now() - 30 * 24 * 60 * 60 * 1000
    for (const key of ['source', 'target']) {
      const raw = storage.getItem(keyForSession(key))
      if (raw === null) continue
      const parsed = JSON.parse(raw)
      storage.setItem(keyForSession(key), JSON.stringify({ ...parsed, updatedAt: stale }))
    }
    const removed = pruneSessions(storage, Date.now())
    expect(removed).not.toContain('source')
    expect(storage.getItem(keyForSession('source'))).not.toBeNull()
    const payload = JSON.parse(storage.getItem(keyForSession('source'))!)
    expect(payload.outbound[0].state).toBe('sent')
  })

  it('prunes an unsent handoff pair together by age', async () => {
    const storage = memoryStorage()
    const store = await freshStore(storage)
    put(store, 'target')
    const stale = Date.now() - 30 * 24 * 60 * 60 * 1000
    const raw = JSON.parse(storage.getItem(keyForSession('source'))!)
    raw.outbound[0].updatedAt = stale
    raw.outbound[0].createdAt = stale
    storage.setItem(keyForSession('source'), JSON.stringify(raw))
    // The target key stays fresh; only the handoff's own timestamp may decide.
    pruneSessions(storage, Date.now())
    const sourceAfter = JSON.parse(storage.getItem(keyForSession('source')) ?? 'null')
    expect(sourceAfter).toBeNull()
    const targetPayload = JSON.parse(storage.getItem(keyForSession('target')) ?? 'null')
    expect(targetPayload?.items ?? []).toHaveLength(0)
  })

  it('never drops a fresh cross-session item with an old target session key', async () => {
    const storage = memoryStorage()
    const store = await freshStore(storage)
    put(store, 'target')
    const stale = Date.now() - 30 * 24 * 60 * 60 * 1000
    const raw = JSON.parse(storage.getItem(keyForSession('target'))!)
    storage.setItem(
      keyForSession('target'),
      JSON.stringify({ ...raw, updatedAt: stale }),
    )
    pruneSessions(storage, Date.now())
    const targetPayload = JSON.parse(storage.getItem(keyForSession('target')) ?? 'null')
    expect(targetPayload?.items).toHaveLength(1)
    expect(targetPayload?.items[0].origin.sessionId).toBe('source')
  })

  it('reads a v1 payload as items with no outbound records', async () => {
    const storage = memoryStorage()
    storage.setItem(
      keyForSession('legacy'),
      JSON.stringify({
        v: 1,
        updatedAt: Date.now(),
        items: [{ id: 'ann_legacy', text: '旧数据', sources: [{ text: '旧数据' }] }],
      }),
    )
    const store = await freshStore(storage)
    store.bindAnnotationSession('legacy')
    await flush()
    expect(store.getAnnotations()).toHaveLength(1)
    expect(store.getOutbound()).toHaveLength(0)
  })
})
