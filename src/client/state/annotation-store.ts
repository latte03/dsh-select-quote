/** Per-session pending selection annotations + source-side handoff records. */

import {
  previewTitle,
  type AnnotationSource,
  type RestoredAnnotation,
  type SelectionAnnotation,
} from '../protocol/annotation-protocol.ts'
import { runtime, setRuntimeSession } from '../runtime.ts'
import type { AnnotationPersistence } from './annotation-persistence.ts'
import {
  groupHandoffs,
  newHandoffId,
  originOfHandoff,
  selectionKeyOf,
  type HandoffDestination,
  type HandoffGroup,
  type OutboundAnnotation,
} from './handoff.ts'

export type { SelectionAnnotation, AnnotationSource }
export type { OutboundAnnotation, HandoffDestination, HandoffGroup }

const EMPTY: readonly SelectionAnnotation[] = []
const EMPTY_OUT: readonly OutboundAnnotation[] = []

/** Bucket for annotations added before a session id is known (never persisted). */
const MEMORY_KEY = 'pending'

const bySession = new Map<string, SelectionAnnotation[]>()
const outboundBySession = new Map<string, OutboundAnnotation[]>()
/** Partitions already read from storage (an absent key means "empty"). */
const loaded = new Set<string>()
const listeners = new Set<() => void>()

let persistence: AnnotationPersistence | null = null
let degraded = false

function notify(): void {
  for (const listener of [...listeners]) listener()
}

export function subscribeAnnotations(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export interface SaveAnnotationInput {
  readonly text: string
  readonly comment?: string
  readonly sources?: readonly AnnotationSource[]
}

/**
 * Store partition: the live session when one is bound, otherwise a memory-only
 * bucket. The host always mints a session before the composer accepts text, so
 * the bucket is the "cannot happen" path and never reaches storage.
 */
function partition(sessionId?: string): string {
  return sessionId ?? runtime.sessionId ?? MEMORY_KEY
}

/** Attach the persistence port (null detaches it). */
export function setAnnotationPersistence(port: AnnotationPersistence | null): void {
  persistence = port
  loaded.clear()
}

/** Whether the last write reached storage; false means memory-only. */
export function isPersistenceDegraded(): boolean {
  return degraded
}

function itemsOf(sessionId: string): SelectionAnnotation[] {
  return bySession.get(sessionId) ?? []
}

function outboundOf(sessionId: string): OutboundAnnotation[] {
  return outboundBySession.get(sessionId) ?? []
}

function ensureLoaded(sessionId: string): void {
  if (sessionId === MEMORY_KEY || loaded.has(sessionId) || !persistence) return
  loaded.add(sessionId)
  const items = persistence.load(sessionId)
  const outbound = persistence.loadOutbound(sessionId)
  if (items.length > 0 && !bySession.has(sessionId)) bySession.set(sessionId, [...items])
  if (outbound.length > 0 && !outboundBySession.has(sessionId)) {
    outboundBySession.set(sessionId, [...outbound])
  }
}

/**
 * Persist one partition. Storage failure is not fatal: memory still answers
 * for this page's lifetime, and `persisted: false` lets the handoff surface
 * tell the user it will not survive a refresh.
 */
function persistItems(sessionId: string): boolean {
  if (!persistence || sessionId === MEMORY_KEY) return true
  const ok = persistence.save(sessionId, itemsOf(sessionId)) !== false
  if (!ok) degraded = true
  return ok
}

function persistOutbound(sessionId: string): boolean {
  if (!persistence || sessionId === MEMORY_KEY) return true
  const ok = persistence.saveOutbound(sessionId, outboundOf(sessionId)) !== false
  if (!ok) degraded = true
  return ok
}

function setItems(sessionId: string, items: SelectionAnnotation[]): void {
  if (items.length === 0) bySession.delete(sessionId)
  else bySession.set(sessionId, items)
}

function setOutbound(sessionId: string, records: OutboundAnnotation[]): void {
  if (records.length === 0) outboundBySession.delete(sessionId)
  else outboundBySession.set(sessionId, records)
}

/** Drop a storage key only when both halves are empty. */
function persistPartition(sessionId: string): boolean {
  if (!persistence || sessionId === MEMORY_KEY) return true
  const items = itemsOf(sessionId)
  const outbound = outboundOf(sessionId)
  if (items.length === 0 && outbound.length === 0) {
    persistence.clear(sessionId)
    return true
  }
  return persistItems(sessionId) && persistOutbound(sessionId)
}

function newAnnotationId(): string {
  return `ann_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Append one selection; an identical text+comment pair is reused. */
export function saveAnnotation(
  sessionId: string | undefined,
  input: SaveAnnotationInput,
): SelectionAnnotation {
  const k = partition(sessionId)
  ensureLoaded(k)
  const comment = input.comment?.trim() ?? ''
  const current = itemsOf(k)
  const duplicate = current.find(
    (item) =>
      item.text === input.text &&
      (item.comment ?? '') === comment &&
      item.origin === undefined,
  )
  if (duplicate) return duplicate

  const annotation: SelectionAnnotation = {
    id: newAnnotationId(),
    text: input.text,
    ...(comment ? { comment } : {}),
    sources: input.sources?.length ? input.sources : [{ text: input.text }],
  }
  setItems(k, [...current, annotation])
  persistItems(k)
  notify()
  return annotation
}

/**
 * Re-adopt annotations lifted out of a composed message.
 *
 * dsh-rewind puts a withdrawn message back into the composer verbatim, so the
 * protocol block arrives there too; the composer half parses it and hands the
 * items here. Same text+comment pairs already pending win, so a repeated
 * restore never duplicates a card. `origin` and its `handoffId` are preserved:
 * a restored cross-session annotation must keep syncing with its source record
 * (and flips that record back to `pending`).
 */
export function restoreAnnotations(
  sessionId: string | undefined,
  items: readonly RestoredAnnotation[],
): number {
  const k = partition(sessionId)
  ensureLoaded(k)
  const current = itemsOf(k)
  const next = [...current]
  for (const item of items) {
    const text = item.text.trim()
    if (!text) continue
    const comment = item.comment?.trim() ?? ''
    const origin = item.origin
    const duplicate = next.some(
      (entry) =>
        entry.text === text &&
        (entry.comment ?? '') === comment &&
        (origin === undefined
          ? entry.origin === undefined
          : entry.origin?.sessionId === origin.sessionId &&
            entry.origin?.handoffId === origin.handoffId),
    )
    if (duplicate) continue
    next.push({
      id: newAnnotationId(),
      text,
      ...(comment ? { comment } : {}),
      sources: item.sources.length > 0 ? item.sources : [{ text }],
      ...(origin ? { origin } : {}),
    })
  }
  if (next.length === current.length) return 0
  setItems(k, next)
  persistItems(k)
  for (const item of next) {
    if (!item.origin) continue
    const records = outboundOf(item.origin.sessionId)
    const record = records.find((entry) => entry.id === item.origin?.handoffId)
    if (!record) continue
    const updated = { ...record, state: 'pending' as const, updatedAt: Date.now() }
    setOutbound(
      item.origin.sessionId,
      records.map((entry) => (entry.id === record.id ? updated : entry)),
    )
    persistOutbound(item.origin.sessionId)
  }
  notify()
  return next.length - current.length
}

export function getAnnotations(sessionId?: string): readonly SelectionAnnotation[] {
  return bySession.get(partition(sessionId)) ?? EMPTY
}

/** Source-side handoff records for one session (active by default). */
export function getOutbound(sessionId?: string): readonly OutboundAnnotation[] {
  return outboundBySession.get(partition(sessionId)) ?? EMPTY_OUT
}

export function outboundGroups(sessionId?: string): readonly HandoffGroup[] {
  return groupHandoffs(getOutbound(sessionId))
}

/** Update a pending annotation's comment; a handoff item syncs its source. */
export function updateAnnotationComment(
  sessionId: string | undefined,
  id: string,
  comment: string,
): void {
  const k = partition(sessionId)
  ensureLoaded(k)
  const current = bySession.get(k)
  if (!current) return
  const trimmed = comment.trim()
  let origin: SelectionAnnotation['origin']
  const next = current.map((item) => {
    if (item.id !== id) return item
    origin = item.origin
    return trimmed ? { ...item, comment: trimmed } : { ...item, comment: undefined }
  })
  bySession.set(k, next)
  persistItems(k)
  if (origin) syncOutboundComment(origin.sessionId, origin.handoffId, trimmed)
  notify()
}

/** Delete one pending annotation; a handoff item removes its source record. */
export function removeAnnotation(sessionId: string | undefined, id: string): void {
  const k = partition(sessionId)
  ensureLoaded(k)
  const current = bySession.get(k)
  if (!current) return
  const target = current.find((item) => item.id === id)
  if (!target) return
  const next = current.filter((item) => item.id !== id)
  setItems(k, next)
  persistItems(k)
  if (target.origin) removeOutboundRecord(target.origin.sessionId, target.origin.handoffId)
  notify()
}

/**
 * Clear a partition.
 *
 * `'sent'` is the send gesture: cross-session records stay (permanently, state
 * `sent`) while the target list empties. `'discarded'` is every other path
 * (remove-all, target-side delete): the paired source records go too.
 */
export function clearAnnotations(
  sessionId?: string,
  reason: 'sent' | 'discarded' = 'discarded',
): void {
  const k = partition(sessionId)
  ensureLoaded(k)
  const current = itemsOf(k)
  const handoffs = current
    .map((item) => item.origin)
    .filter((origin): origin is NonNullable<typeof origin> => origin !== undefined)
  if (handoffs.length > 0) {
    const bySource = new Map<string, OutboundAnnotation[]>()
    for (const origin of handoffs) {
      const records = bySource.get(origin.sessionId) ?? [...outboundOf(origin.sessionId)]
      bySource.set(
        origin.sessionId,
        records
          .filter((record) =>
            reason === 'discarded' ? record.id !== origin.handoffId : true,
          )
          .map((record) =>
            reason === 'sent' && record.id === origin.handoffId
              ? { ...record, state: 'sent' as const, updatedAt: Date.now() }
              : record,
          ),
      )
    }
    for (const [sourceId, records] of bySource) {
      setOutbound(sourceId, records)
      persistOutbound(sourceId)
    }
  }
  if (current.length === 0) return
  bySession.delete(k)
  persistPartition(k)
  notify()
}

function handoffIdOf(record: OutboundAnnotation): string {
  return record.id
}

/** Mark one source record as sent (source mark survives, "取消放入" goes away). */
export function markHandoffSent(sourceSessionId: string, handoffId: string): void {
  ensureLoaded(sourceSessionId)
  const records = outboundOf(sourceSessionId)
  if (!records.some((record) => record.id === handoffId)) return
  setOutbound(
    sourceSessionId,
    records.map((record) =>
      record.id === handoffId ? { ...record, state: 'sent', updatedAt: Date.now() } : record,
    ),
  )
  persistOutbound(sourceSessionId)
  notify()
}

export function syncOutboundComment(
  sourceSessionId: string,
  handoffId: string,
  comment: string,
): void {
  ensureLoaded(sourceSessionId)
  const records = outboundOf(sourceSessionId)
  const trimmed = comment.trim()
  if (!records.some((record) => record.id === handoffId)) return
  setOutbound(
    sourceSessionId,
    records.map((record) =>
      record.id === handoffId
        ? {
            ...record,
            ...(trimmed ? { comment: trimmed } : { comment: undefined }),
            updatedAt: Date.now(),
          }
        : record,
    ),
  )
  persistOutbound(sourceSessionId)
  notify()
}

/** Update one source record, then the paired target item, in one action. */
export function updateHandoffComment(
  sourceSessionId: string,
  handoffId: string,
  comment: string,
): void {
  ensureLoaded(sourceSessionId)
  const records = outboundOf(sourceSessionId)
  const record = records.find((entry) => entry.id === handoffId)
  if (!record) return
  const trimmed = comment.trim()
  setOutbound(
    sourceSessionId,
    records.map((entry) =>
      entry.id === handoffId
        ? {
            ...entry,
            ...(trimmed ? { comment: trimmed } : { comment: undefined }),
            updatedAt: Date.now(),
          }
        : entry,
    ),
  )
  persistOutbound(sourceSessionId)

  const targetId = record.destination.sessionId
  ensureLoaded(targetId)
  const targetItems = itemsOf(targetId)
  let changed = false
  const next = targetItems.map((item) => {
    if (item.origin?.handoffId !== handoffId) return item
    changed = true
    return { ...item, ...(trimmed ? { comment: trimmed } : { comment: undefined }) }
  })
  if (changed) {
    setItems(targetId, next)
    persistItems(targetId)
  }
  notify()
}

/** Remove one source record and its paired target item. */
export function removeOutboundRecord(sourceSessionId: string, handoffId: string): boolean {
  ensureLoaded(sourceSessionId)
  const records = outboundOf(sourceSessionId)
  const record = records.find((entry) => entry.id === handoffId)
  let paired = false
  if (record) {
    const targetId = record.destination.sessionId
    ensureLoaded(targetId)
    const targetItems = itemsOf(targetId)
    const kept = targetItems.filter((item) => item.origin?.handoffId !== handoffId)
    paired = kept.length !== targetItems.length
    if (paired) {
      setItems(targetId, kept)
      persistPartition(targetId)
    }
    setOutbound(
      sourceSessionId,
      records.filter((entry) => entry.id !== handoffId),
    )
    persistOutbound(sourceSessionId)
    notify()
    return paired
  }
  // The source record is already gone (another tab, or a pruned key): sweep any
  // target copy so a mark cannot outlive its record.
  for (const sessionId of new Set([...bySession.keys()])) {
    const items = itemsOf(sessionId)
    const kept = items.filter((item) => item.origin?.handoffId !== handoffId)
    if (kept.length === items.length) continue
    paired = true
    setItems(sessionId, kept)
    persistPartition(sessionId)
  }
  if (paired) notify()
  return paired
}

export interface HandoffInput {
  readonly text: string
  readonly comment?: string
  readonly sources?: readonly AnnotationSource[]
  /** Source session identity recorded on the target item. */
  readonly origin: { readonly sessionId: string; readonly title: string }
  readonly destination: HandoffDestination
  /** Reuse an id when retrying after a failed create. */
  readonly handoffId?: string
}

export interface HandoffResult {
  readonly item: SelectionAnnotation
  readonly outbound: OutboundAnnotation
  /** False means the write stayed in memory; a refresh loses it. */
  readonly persisted: boolean
  /** True when this selection already existed for the same target. */
  readonly reused: boolean
}

/**
 * Write one handoff: the target's pending item first, then the source outbound
 * record. Both sides are updated in memory before either write, so a storage
 * failure still leaves a coherent in-memory pair for this page.
 */
export function saveHandoff(
  sourceSessionId: string,
  input: HandoffInput,
): HandoffResult {
  const targetId = input.destination.sessionId
  ensureLoaded(sourceSessionId)
  ensureLoaded(targetId)
  const sources = input.sources?.length ? input.sources : [{ text: input.text }]
  const comment = input.comment?.trim() ?? ''
  const selectionKey = selectionKeyOf(input.text, sources[0])
  const now = Date.now()

  const sourceRecords = outboundOf(sourceSessionId)
  const existingRecord = sourceRecords.find(
    (record) => record.text === input.text && record.destination.sessionId === targetId,
  )
  const targetItems = itemsOf(targetId)
  const existingItem = targetItems.find(
    (item) => item.text === input.text && item.origin?.sessionId === sourceSessionId,
  )
  const handoffId =
    existingRecord?.id ?? existingItem?.origin?.handoffId ?? input.handoffId ?? newHandoffId(selectionKey)
  const origin = originOfHandoff(sourceSessionId, input.origin.title, handoffId)

  const item: SelectionAnnotation = existingItem
    ? {
        ...existingItem,
        ...(input.comment === undefined ? {} : { comment: comment || undefined }),
        sources: existingItem.sources.length > 0 ? existingItem.sources : sources,
        origin,
      }
    : {
        id: newAnnotationId(),
        text: input.text,
        ...(comment ? { comment } : {}),
        sources,
        origin,
      }

  const nextItems = existingItem
    ? targetItems.map((entry) => (entry.id === existingItem.id ? item : entry))
    : [...targetItems, item]

  const record: OutboundAnnotation = existingRecord
    ? {
        ...existingRecord,
        ...(input.comment === undefined ? {} : { comment: comment || undefined }),
        sources: existingRecord.sources.length > 0 ? existingRecord.sources : sources,
        destination: input.destination,
        state: 'pending',
        updatedAt: now,
      }
    : {
        id: handoffId,
        text: input.text,
        ...(comment ? { comment } : {}),
        sources,
        selectionKey,
        destination: input.destination,
        state: 'pending',
        createdAt: now,
        updatedAt: now,
      }

  const nextRecords = existingRecord
    ? sourceRecords.map((entry) => (entry.id === existingRecord.id ? record : entry))
    : [...sourceRecords, record]

  setItems(targetId, nextItems)
  setOutbound(sourceSessionId, nextRecords)
  const targetOk = persistItems(targetId)
  const sourceOk = persistOutbound(sourceSessionId)
  notify()
  return {
    item,
    outbound: record,
    persisted: targetOk && sourceOk,
    reused: existingRecord !== undefined,
  }
}

/**
 * Fallback reconciliation after binding, startup, a `storage` event or a
 * prune. It repairs one-sided states only — the event-synced paths above are
 * the primary contract, and this never runs on a timer.
 */
export function reconcileHandoffs(): boolean {
  let changed = false
  // Prime every stored partition so a pair split across two pages (or a
  // half-write from a previous version) is visible to the checks below.
  for (const sessionId of persistence?.listSessions() ?? []) {
    if (sessionId !== MEMORY_KEY) ensureLoaded(sessionId)
  }

  for (const sourceId of [...outboundBySession.keys()]) {
    const records = outboundOf(sourceId)
    const kept: OutboundAnnotation[] = []
    for (const record of records) {
      if (record.state === 'sent') {
        kept.push(record)
        continue
      }
      ensureLoaded(record.destination.sessionId)
      const paired = itemsOf(record.destination.sessionId).some(
        (item) => item.origin?.handoffId === record.id,
      )
      if (paired) kept.push(record)
      else changed = true
    }
    if (kept.length !== records.length) {
      setOutbound(sourceId, kept)
      persistOutbound(sourceId)
    }
  }

  for (const sessionId of [...bySession.keys()]) {
    const items = itemsOf(sessionId)
    const kept = items.filter((item) => {
      if (!item.origin) return true
      ensureLoaded(item.origin.sessionId)
      const record = outboundOf(item.origin.sessionId).find(
        (entry) => entry.id === item.origin?.handoffId,
      )
      // A `sent` record after the target was cleared is the normal state; a
      // target item that still exists then is the anomaly, so both drop it.
      return record?.state === 'pending'
    })
    if (kept.length !== items.length) {
      setItems(sessionId, kept)
      persistPartition(sessionId)
      changed = true
    }
  }

  if (changed) notify()
  return changed
}

/** Mark every cross-session item as sent before a send clears the target. */
export function markHandoffsSent(sessionId?: string): void {
  const k = partition(sessionId)
  ensureLoaded(k)
  const ids = new Map<string, string[]>()
  for (const item of itemsOf(k)) {
    if (!item.origin) continue
    const list = ids.get(item.origin.sessionId) ?? []
    list.push(item.origin.handoffId)
    ids.set(item.origin.sessionId, list)
  }
  for (const [sourceId, handoffIds] of ids) {
    ensureLoaded(sourceId)
    const records = outboundOf(sourceId)
    const next = records.map((record) =>
      handoffIds.includes(handoffIdOf(record))
        ? { ...record, state: 'sent' as const, updatedAt: Date.now() }
        : record,
    )
    setOutbound(sourceId, next)
    persistOutbound(sourceId)
  }
}

/**
 * Bind the active session and adopt whatever it left unsent.
 *
 * Called from render-phase bridges, so adoption is deferred to a microtask:
 * the resulting notify() must not land inside another component's render.
 * Re-binding the same session is a no-op.
 *
 * A rebind is itself a publication even when adoption changes nothing: the
 * host mints a brand-new session id on a fork (annotations are not
 * inherited), and subscribers like the pending-mark job sync must re-read
 * the new partition so the previous session's marks are dropped instead of
 * bleeding into the forked transcript while the composer card is already
 * gone.
 *
 * A bind superseded in the same tick adopts nothing: running its adoption
 * would publish a partition that is no longer active. Its stored data is
 * untouched and is picked up when that session is bound again.
 */
function usableSessionId(value: string | undefined): string | undefined {
  return value === undefined || value === '' || value === 'undefined' || value === 'null'
    ? undefined
    : value
}

export function bindAnnotationSession(sessionId: string | undefined): void {
  // Root-scoped slot props can stringify an absent id ("undefined"/"null");
  // taking that as a partition key would put every annotation under a fake
  // session and silently overwrite the composer-provided real id.
  const id = usableSessionId(sessionId)
  if (!id || id === runtime.sessionId) return
  // Embedded subagent conversations have their own session partition; they may
  // read and write it explicitly, but must not take over the main binding.
  if (runtime.isSubagentSession?.(id) === true) return
  setRuntimeSession(id)
  queueMicrotask(() => {
    if (runtime.sessionId !== id) return
    const adopted = adoptPersistedAnnotations(id)
    const reconciled = reconcileHandoffs()
    if (!adopted && !reconciled) notify()
  })
}

/**
 * Adopt persisted annotations for a session.
 *
 * In-memory entries win on conflict — they can only be newer, because anything
 * added after the bind is persisted immediately. Annotations parked in the
 * memory-only bucket (added before the bind) move over as well.
 *
 * Returns whether the partition changed (and published): `false` means the
 * stored state already matched memory, so callers that also represent "the
 * active partition moved" (see `bindAnnotationSession`) still need to publish.
 */
export function adoptPersistedAnnotations(sessionId: string): boolean {
  if (!persistence) return false
  const stored = persistence.load(sessionId)
  const storedOutbound = persistence.loadOutbound(sessionId)
  loaded.add(sessionId)
  const current = bySession.get(sessionId) ?? EMPTY
  const orphaned = bySession.get(MEMORY_KEY) ?? EMPTY

  const merged = new Map<string, SelectionAnnotation>()
  for (const item of stored) merged.set(item.id, item)
  for (const item of [...current, ...orphaned]) merged.set(item.id, item)

  const next = [...merged.values()]
  const prevOutbound = outboundBySession.get(sessionId) ?? EMPTY_OUT
  const mergedOutbound = new Map<string, OutboundAnnotation>()
  for (const record of storedOutbound) mergedOutbound.set(record.id, record)
  for (const record of prevOutbound) mergedOutbound.set(record.id, record)
  const nextOutbound = [...mergedOutbound.values()]

  const sameAsCurrent =
    next.length === current.length && next.every((item, i) => item.id === current[i]?.id)
  const sameOutbound =
    nextOutbound.length === prevOutbound.length &&
    nextOutbound.every((record, i) => record.id === prevOutbound[i]?.id)
  if (sameAsCurrent && sameOutbound && orphaned.length === 0) return false

  setItems(sessionId, next)
  setOutbound(sessionId, nextOutbound)
  if (orphaned.length > 0) bySession.delete(MEMORY_KEY)
  notify()
  return true
}

/** Same ids in the same order, with the only mutable field (comment) equal. */
function sameAnnotations(
  a: readonly SelectionAnnotation[],
  b: readonly SelectionAnnotation[],
): boolean {
  return (
    a.length === b.length &&
    a.every((item, i) => {
      const other = b[i]
      return other !== undefined && item.id === other.id && (item.comment ?? '') === (other.comment ?? '')
    })
  )
}

function sameOutbound(
  a: readonly OutboundAnnotation[],
  b: readonly OutboundAnnotation[],
): boolean {
  return (
    a.length === b.length &&
    a.every((record, i) => {
      const other = b[i]
      return (
        other !== undefined &&
        record.id === other.id &&
        record.state === other.state &&
        (record.comment ?? '') === (other.comment ?? '')
      )
    })
  )
}

/**
 * Re-read a session after another tab wrote its storage key.
 *
 * Storage is the shared source of truth: every local mutation persists
 * synchronously, so this tab's memory can only be stale relative to it. The
 * stored arrays replace the local ones (last writer wins) — merging would
 * resurrect annotations the other tab already sent and cleared.
 *
 * `null` is the `localStorage.clear()` event: reload every partition this tab
 * holds. Sessions that are neither cached nor active are ignored; binding the
 * session later reads storage anyway.
 */
export function adoptStorageAnnotations(sessionId: string | null): void {
  if (!persistence) return
  if (sessionId === null) {
    let changed = false
    for (const key of [...bySession.keys()]) {
      if (key === MEMORY_KEY) continue
      const stored = persistence.load(key)
      const current = bySession.get(key)
      if (stored.length === 0) {
        bySession.delete(key)
        changed = true
      } else if (current === undefined || !sameAnnotations(stored, current)) {
        bySession.set(key, [...stored])
        changed = true
      }
    }
    for (const key of [...outboundBySession.keys()]) {
      if (key === MEMORY_KEY) continue
      const stored = persistence.loadOutbound(key)
      const current = outboundBySession.get(key)
      if (stored.length === 0) {
        outboundBySession.delete(key)
        changed = true
      } else if (current === undefined || !sameOutbound(stored, current)) {
        outboundBySession.set(key, [...stored])
        changed = true
      }
    }
    if (changed) {
      reconcileHandoffs()
      notify()
    }
    return
  }
  if (!bySession.has(sessionId) && !outboundBySession.has(sessionId) && sessionId !== runtime.sessionId) {
    return
  }
  const stored = persistence.load(sessionId)
  const storedOutbound = persistence.loadOutbound(sessionId)
  const current = bySession.get(sessionId) ?? EMPTY
  const currentOutbound = outboundBySession.get(sessionId) ?? EMPTY_OUT
  if (sameAnnotations(stored, current) && sameOutbound(storedOutbound, currentOutbound)) return
  setItems(sessionId, [...stored])
  setOutbound(sessionId, [...storedOutbound])
  reconcileHandoffs()
  notify()
}

export function annotationTitle(annotation: SelectionAnnotation): string {
  return previewTitle(annotation.text)
}
