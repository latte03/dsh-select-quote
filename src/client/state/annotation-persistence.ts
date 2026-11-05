/**
 * Persistence for pending (unsent) annotations and handoff records.
 *
 * The host already persists the composer draft per session
 * (`dsh.conversation.<sessionId>`), and the invisible U+200B marker is part of
 * that draft — so before this module a refresh came back with the orphan marker
 * and an empty annotation list. Annotations now ride the same per-session shape.
 *
 * Payload `v: 2` adds `outbound` (source-side handoff records). A `v: 1`
 * payload reads as `outbound: []`, so the upgrade is a no-op for stored data.
 *
 * Storage is injected and this module touches no DOM, so verify-bundle replays
 * the whole cycle (save → drop memory → reload → reconcile) headlessly.
 */

import type { SelectionAnnotation } from '../protocol/annotation-protocol.ts'
import type { OutboundAnnotation } from './handoff.ts'

/** localStorage prefix; a session id is appended as `.<sessionId>`. */
export const ANNOTATION_KEY_PREFIX = 'dsh.select-quote.annotations'

/** Q6 ①: the newest N sessions / handoffs survive; anything old is dropped. */
export const MAX_SESSIONS = 20
export const MAX_SESSION_AGE_MS = 7 * 24 * 60 * 60 * 1000

const PAYLOAD_VERSION = 2

export interface AnnotationPayload {
  readonly v: number
  readonly updatedAt: number
  readonly items: readonly SelectionAnnotation[]
  readonly outbound: readonly OutboundAnnotation[]
}

/** One stored partition, decoded. */
export interface AnnotationPartition {
  readonly items: readonly SelectionAnnotation[]
  readonly outbound: readonly OutboundAnnotation[]
}

export interface AnnotationPersistence {
  load(sessionId: string): readonly SelectionAnnotation[]
  save(sessionId: string, items: readonly SelectionAnnotation[]): boolean
  /** Source-side handoff records; written without touching `items`. */
  loadOutbound(sessionId: string): readonly OutboundAnnotation[]
  saveOutbound(sessionId: string, outbound: readonly OutboundAnnotation[]): boolean
  clear(sessionId: string): void
  /** Every stored partition id (reconciliation primes them at startup). */
  listSessions(): readonly string[]
  /** Drop sessions/handoffs outside the retention window; returns removed ids. */
  prune(now?: number): readonly string[]
}

/** The storage surface the backend needs: localStorage, or a Map in tests. */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  keys(): readonly string[]
}

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

function isOutbound(value: unknown): value is OutboundAnnotation {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<OutboundAnnotation>
  return (
    typeof item.id === 'string' &&
    typeof item.text === 'string' &&
    typeof item.selectionKey === 'string' &&
    Array.isArray(item.sources) &&
    (item.state === 'pending' || item.state === 'sent') &&
    item.destination !== null &&
    typeof item.destination === 'object' &&
    typeof (item.destination as { sessionId?: unknown }).sessionId === 'string'
  )
}

/** Tolerant read: a corrupt or foreign payload degrades to "nothing stored". */
function partitionOf(value: unknown): AnnotationPartition {
  if (!value || typeof value !== 'object') return { items: [], outbound: [] }
  const payload = value as Partial<AnnotationPayload>
  return {
    items: Array.isArray(payload.items) ? payload.items.filter(isAnnotation) : [],
    outbound: Array.isArray(payload.outbound) ? payload.outbound.filter(isOutbound) : [],
  }
}

function encode(partition: AnnotationPartition, now: number): string {
  return JSON.stringify({
    v: PAYLOAD_VERSION,
    updatedAt: now,
    items: partition.items,
    outbound: partition.outbound,
  })
}

function decode(raw: string | null): AnnotationPartition {
  if (raw === null) return { items: [], outbound: [] }
  try {
    return partitionOf(JSON.parse(raw))
  } catch {
    return { items: [], outbound: [] }
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
 * Direct localStorage backend. Writes are wrapped so a quota failure degrades
 * to memory-only instead of breaking the composer. A failed write returns
 * `false` so the caller can surface "kept until this refresh only".
 */
export function createStoragePersistence(storage: KeyValueStorage): AnnotationPersistence {
  let degraded = false
  const read = (sessionId: string): AnnotationPartition =>
    decode(storage.getItem(keyForSession(sessionId)))
  const write = (sessionId: string, partition: AnnotationPartition): boolean => {
    if (degraded) return false
    try {
      storage.setItem(keyForSession(sessionId), encode(partition, Date.now()))
      return true
    } catch {
      degraded = true
      warnQuota()
      return false
    }
  }
  return {
    load: (sessionId) => read(sessionId).items,
    save: (sessionId, items) => write(sessionId, { items, outbound: read(sessionId).outbound }),
    loadOutbound: (sessionId) => read(sessionId).outbound,
    saveOutbound: (sessionId, outbound) =>
      write(sessionId, { items: read(sessionId).items, outbound }),
    clear: (sessionId) => {
      try {
        storage.removeItem(keyForSession(sessionId))
      } catch {
        /* nothing to drop */
      }
    },
    listSessions: () =>
      storage
        .keys()
        .map(sessionIdOfKey)
        .filter((sessionId): sessionId is string => sessionId !== null),
    prune: (now) => pruneSessions(storage, now),
  }
}

interface StoredRow extends AnnotationPartition {
  readonly sessionId: string
  readonly updatedAt: number
}

function rowsOf(storage: KeyValueStorage): StoredRow[] {
  const rows: StoredRow[] = []
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
    rows.push({ sessionId, updatedAt, ...decode(raw) })
  }
  return rows
}

/**
 * Retention, split by record kind:
 *
 * - a key holding a `sent` outbound record is never session-pruned, so
 *   "permanent after send" survives;
 * - local pending items keep the 20-session / 7-day rule;
 * - cross-session target items are never dropped by the target key's age —
 *   they belong to a handoff, judged by the handoff's own timestamps;
 * - an unsent handoff (source `pending` record + target item) is dropped as a
 *   pair by the same 20 / 7-day budget;
 * - empty keys are removed.
 */
export function pruneSessions(
  storage: KeyValueStorage,
  now: number = Date.now(),
  options: { maxSessions?: number; maxAgeMs?: number } = {},
): readonly string[] {
  const maxSessions = options.maxSessions ?? MAX_SESSIONS
  const maxAgeMs = options.maxAgeMs ?? MAX_SESSION_AGE_MS
  const rows = rowsOf(storage)
  const removed = new Set<string>()
  const changed = new Set<string>()
  const rowOf = new Map(rows.map((row) => [row.sessionId, row] as const))

  // 1. An empty partition carries no state; drop it once it is stale (a fresh
  // empty key is left alone, matching the pre-handoff retention behaviour).
  for (const row of rows) {
    if (
      row.items.length === 0 &&
      row.outbound.length === 0 &&
      now - row.updatedAt > maxAgeMs
    ) {
      removed.add(row.sessionId)
    }
  }

  // 2. Local pending annotations: newest N sessions within the age window.
  const localRows = rows.filter(
    (row) =>
      row.items.some((item) => !item.origin) &&
      !row.outbound.some((record) => record.state === 'sent'),
  )
  const dropLocal = new Set<StoredRow>()
  for (const row of localRows) {
    if (now - row.updatedAt > maxAgeMs) dropLocal.add(row)
  }
  const ranked = [...localRows].sort((a, b) => b.updatedAt - a.updatedAt)
  for (const row of ranked.slice(maxSessions)) dropLocal.add(row)
  for (const row of dropLocal) {
    const kept = row.items.filter((item) => item.origin !== undefined)
    if (kept.length === row.items.length) continue
    changed.add(row.sessionId)
    rowOf.set(row.sessionId, { ...row, items: kept })
  }

  // 3. Unsent handoffs: one retention unit per outbound record, paired target
  // items go with it. Sent records are permanent and never enter this list.
  const pending: { record: OutboundAnnotation; source: StoredRow }[] = []
  for (const row of rows) {
    for (const record of row.outbound) {
      if (record.state === 'pending') pending.push({ record, source: row })
    }
  }
  const expired = new Set<string>()
  for (const { record } of pending) {
    if (now - record.updatedAt > maxAgeMs) expired.add(record.id)
  }
  const byAge = [...pending].sort((a, b) => b.record.updatedAt - a.record.updatedAt)
  for (const { record } of byAge.slice(maxSessions)) expired.add(record.id)

  if (expired.size > 0) {
    for (const { record, source } of pending) {
      if (!expired.has(record.id)) continue
      const current = rowOf.get(source.sessionId) ?? source
      rowOf.set(source.sessionId, {
        ...current,
        outbound: current.outbound.filter((entry) => entry.id !== record.id),
      })
      changed.add(source.sessionId)
      const target = rowOf.get(record.destination.sessionId)
      if (target) {
        const kept = target.items.filter((item) => item.origin?.handoffId !== record.id)
        if (kept.length !== target.items.length) {
          rowOf.set(target.sessionId, { ...target, items: kept })
          changed.add(target.sessionId)
        }
      }
    }
  }

  // 4. Write back. A key that became empty disappears entirely.
  for (const sessionId of changed) {
    if (removed.has(sessionId)) continue
    const row = rowOf.get(sessionId)
    if (!row) continue
    if (row.items.length === 0 && row.outbound.length === 0) {
      removed.add(sessionId)
      continue
    }
    const updatedAt = Math.max(row.updatedAt, now)
    try {
      storage.setItem(keyForSession(sessionId), encode(row, updatedAt))
    } catch {
      /* best effort: a full quota keeps the previous copy */
    }
  }
  for (const sessionId of removed) storage.removeItem(keyForSession(sessionId))
  return [...removed]
}

export function createNoopPersistence(): AnnotationPersistence {
  return {
    load: () => [],
    save: () => false,
    loadOutbound: () => [],
    saveOutbound: () => false,
    clear: () => {},
    listSessions: () => [],
    prune: () => [],
  }
}
