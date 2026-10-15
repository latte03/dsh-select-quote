/**
 * Persistence for pending (unsent) annotations.
 *
 * The host already persists the composer draft per session
 * (`dsh.conversation.<sessionId>`), and the invisible U+200B marker is part of
 * that draft — so before this module a refresh came back with the orphan marker
 * and an empty annotation list. Annotations now ride the same per-session shape.
 *
 * Storage is injected and this module touches no DOM, so verify-bundle replays
 * the whole cycle (save → drop memory → reload → reconcile) headlessly.
 */

import type { SelectionAnnotation } from './annotation-store.ts'

/** localStorage prefix; a session id is appended as `.<sessionId>`. */
export const ANNOTATION_KEY_PREFIX = 'dsh.select-quote.annotations'

/** Q6 ①: the newest N sessions survive, anything older than 7 days is dropped. */
export const MAX_SESSIONS = 20
export const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000

const PAYLOAD_VERSION = 1

export interface AnnotationPayload {
  readonly v: number
  readonly updatedAt: number
  readonly items: readonly SelectionAnnotation[]
}

/** Mutable shape the host store hands to action mutators (immer draft). */
interface AnnotationDraft {
  v: number
  updatedAt: number
  items: SelectionAnnotation[]
}

export interface AnnotationPersistence {
  load(sessionId: string): readonly SelectionAnnotation[]
  save(sessionId: string, items: readonly SelectionAnnotation[]): void
  clear(sessionId: string): void
  /** Drop sessions outside the retention window; returns the removed ids. */
  prune(now?: number): readonly string[]
}

/** The storage surface both backends need: localStorage, or a Map in tests. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  keys(): readonly string[]
}

/** Structural view of the host's client-store `defineStore` (a seed word). */
interface HostStoreInstance {
  getSnapshot(): unknown
  actions: { replace(items: readonly SelectionAnnotation[], now: number): void }
  clearPersisted(): void
}

interface HostStoreHandle {
  create(scopeKey?: string): HostStoreInstance
}

export type DefineStoreLike = (decl: unknown) => HostStoreHandle

export function keyForSession(sessionId: string): string {
  return `${ANNOTATION_KEY_PREFIX}.${sessionId}`
}

export function sessionIdOfKey(key: string): string | null {
  const prefix = `${ANNOTATION_KEY_PREFIX}.`
  return key.startsWith(prefix) ? key.slice(prefix.length) : null
}

function isAnnotation(value: unknown): value is SelectionAnnotation {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<SelectionAnnotation>
  return typeof item.id === 'string' && typeof item.text === 'string' && Array.isArray(item.sources)
}

/** Tolerant read: a corrupt or foreign payload degrades to "nothing stored". */
function itemsOf(value: unknown): readonly SelectionAnnotation[] {
  if (!value || typeof value !== 'object') return []
  const payload = value as Partial<AnnotationPayload>
  if (!Array.isArray(payload.items)) return []
  return payload.items.filter(isAnnotation)
}

function encode(items: readonly SelectionAnnotation[], now: number): string {
  return JSON.stringify({ v: PAYLOAD_VERSION, updatedAt: now, items })
}

function decode(raw: string | null): readonly SelectionAnnotation[] {
  if (raw === null) return []
  try {
    return itemsOf(JSON.parse(raw))
  } catch {
    return []
  }
}

/** One warn per session, never a throw: a full quota must not break typing. */
let quotaWarned = false

function warnQuota(): void {
  if (quotaWarned) return
  quotaWarned = true
  console.warn('dsh-select-quote: annotation persistence disabled (storage write failed)')
}

/**
 * Direct localStorage backend (the documented fallback). Writes are wrapped so
 * a quota failure degrades to memory-only instead of breaking the composer.
 */
export function createStoragePersistence(storage: KeyValueStorage): AnnotationPersistence {
  let degraded = false
  return {
    load: (sessionId) => decode(storage.getItem(keyForSession(sessionId))),
    save: (sessionId, items) => {
      if (degraded) return
      try {
        storage.setItem(keyForSession(sessionId), encode(items, Date.now()))
      } catch {
        degraded = true
        warnQuota()
      }
    },
    clear: (sessionId) => {
      try {
        storage.removeItem(keyForSession(sessionId))
      } catch {
        /* nothing to drop */
      }
    },
    prune: (now) => pruneSessions(storage, now),
  }
}

/**
 * Host store backend: the same `defineStore` the composer draft uses, so the
 * write path, per-session keying and failure semantics are the host's.
 */
export function createHostStorePersistence(
  defineStore: DefineStoreLike,
  storage: KeyValueStorage,
): AnnotationPersistence {
  const handle = defineStore({
    init: (): AnnotationDraft => ({ v: PAYLOAD_VERSION, updatedAt: 0, items: [] }),
    persist: ANNOTATION_KEY_PREFIX,
    actions: {
      replace(draft: AnnotationDraft, items: readonly SelectionAnnotation[], now: number) {
        draft.items = [...items]
        draft.updatedAt = now
      },
    },
  })
  const instances = new Map<string, HostStoreInstance>()
  const instanceOf = (sessionId: string): HostStoreInstance => {
    const cached = instances.get(sessionId)
    if (cached) return cached
    // Construction hydrates from `dsh.select-quote.annotations.<sessionId>`.
    const instance = handle.create(sessionId)
    instances.set(sessionId, instance)
    return instance
  }
  return {
    load: (sessionId) => itemsOf(instanceOf(sessionId).getSnapshot()),
    save: (sessionId, items) => instanceOf(sessionId).actions.replace(items, Date.now()),
    clear: (sessionId) => {
      instanceOf(sessionId).clearPersisted()
      instances.delete(sessionId)
    },
    prune: (now) => {
      const removed = pruneSessions(storage, now)
      for (const sessionId of removed) instances.delete(sessionId)
      return removed
    },
  }
}

/** Retention: newest `maxSessions` within `maxAgeMs`, by payload timestamp. */
export function pruneSessions(
  storage: KeyValueStorage,
  now: number = Date.now(),
  options: { maxSessions?: number; maxAgeMs?: number } = {},
): readonly string[] {
  const maxSessions = options.maxSessions ?? MAX_SESSIONS
  const maxAgeMs = options.maxAgeMs ?? MAX_SESSION_AGE_MS
  const rows: { sessionId: string; updatedAt: number }[] = []
  for (const key of storage.keys()) {
    const sessionId = sessionIdOfKey(key)
    if (sessionId === null) continue
    const raw = storage.getItem(key)
    let updatedAt = 0
    try {
      const parsed = JSON.parse(raw ?? 'null') as { updatedAt?: unknown } | null
      if (parsed && typeof parsed.updatedAt === 'number') updatedAt = parsed.updatedAt
    } catch {
      updatedAt = 0
    }
    rows.push({ sessionId, updatedAt })
  }
  const removed = new Set<string>()
  for (const row of rows) {
    if (now - row.updatedAt > maxAgeMs) removed.add(row.sessionId)
  }
  rows.sort((a, b) => b.updatedAt - a.updatedAt)
  for (const row of rows.slice(maxSessions)) removed.add(row.sessionId)
  for (const sessionId of removed) storage.removeItem(keyForSession(sessionId))
  return [...removed]
}

export function createNoopPersistence(): AnnotationPersistence {
  return {
    load: () => [],
    save: () => {},
    clear: () => {},
    prune: () => [],
  }
}
