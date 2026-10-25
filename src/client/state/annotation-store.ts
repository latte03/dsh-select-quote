/** Per-session pending selection annotations (composer-side store). */

import {
  previewTitle,
  type AnnotationSource,
  type RestoredAnnotation,
  type SelectionAnnotation,
} from '../protocol/annotation-protocol.ts'
import { runtime, setRuntimeSession } from '../runtime.ts'
import type { AnnotationPersistence } from './annotation-persistence.ts'

export type { SelectionAnnotation, AnnotationSource }

const EMPTY: readonly SelectionAnnotation[] = []

/** Bucket for annotations added before a session id is known (never persisted). */
const MEMORY_KEY = 'pending'

const bySession = new Map<string, SelectionAnnotation[]>()
const listeners = new Set<() => void>()

let persistence: AnnotationPersistence | null = null

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
}

function persist(partitionKey: string): void {
  if (!persistence || partitionKey === MEMORY_KEY) return
  persistence.save(partitionKey, bySession.get(partitionKey) ?? EMPTY)
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
  const comment = input.comment?.trim() ?? ''
  const current = bySession.get(k) ?? EMPTY
  const duplicate = current.find(
    (item) => item.text === input.text && (item.comment ?? '') === comment,
  )
  if (duplicate) return duplicate

  const annotation: SelectionAnnotation = {
    id: newAnnotationId(),
    text: input.text,
    ...(comment ? { comment } : {}),
    sources: input.sources?.length ? input.sources : [{ text: input.text }],
  }
  bySession.set(k, [...current, annotation])
  persist(k)
  notify()
  return annotation
}

/**
 * Re-adopt annotations lifted out of a composed message.
 *
 * dsh-rewind puts a withdrawn message back into the composer verbatim, so the
 * protocol block arrives there too; the composer half parses it and hands the
 * items here. Same text+comment pairs already pending win, so a repeated
 * restore never duplicates a card. Returns how many items were added.
 */
export function restoreAnnotations(
  sessionId: string | undefined,
  items: readonly RestoredAnnotation[],
): number {
  const k = partition(sessionId)
  const current = bySession.get(k) ?? EMPTY
  const next = [...current]
  for (const item of items) {
    const text = item.text.trim()
    if (!text) continue
    const comment = item.comment?.trim() ?? ''
    if (next.some((entry) => entry.text === text && (entry.comment ?? '') === comment)) continue
    next.push({
      id: newAnnotationId(),
      text,
      ...(comment ? { comment } : {}),
      sources: item.sources.length > 0 ? item.sources : [{ text }],
    })
  }
  if (next.length === current.length) return 0
  bySession.set(k, next)
  persist(k)
  notify()
  return next.length - current.length
}

export function getAnnotations(sessionId?: string): readonly SelectionAnnotation[] {
  return bySession.get(partition(sessionId)) ?? EMPTY
}

export function updateAnnotationComment(
  sessionId: string | undefined,
  id: string,
  comment: string,
): void {
  const k = partition(sessionId)
  const current = bySession.get(k)
  if (!current) return
  const next = current.map((item) => {
    if (item.id !== id) return item
    const trimmed = comment.trim()
    return trimmed ? { ...item, comment: trimmed } : { ...item, comment: undefined }
  })
  bySession.set(k, next)
  persist(k)
  notify()
}

export function removeAnnotation(sessionId: string | undefined, id: string): void {
  const k = partition(sessionId)
  const current = bySession.get(k)
  if (!current) return
  const next = current.filter((item) => item.id !== id)
  if (next.length === current.length) return
  if (next.length === 0) bySession.delete(k)
  else bySession.set(k, next)
  if (next.length === 0 && k !== MEMORY_KEY) persistence?.clear(k)
  else persist(k)
  notify()
}

export function clearAnnotations(sessionId?: string): void {
  const k = partition(sessionId)
  if (!bySession.delete(k)) return
  if (k !== MEMORY_KEY) persistence?.clear(k)
  notify()
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
 */
export function bindAnnotationSession(sessionId: string | undefined): void {
  if (!sessionId || sessionId === runtime.sessionId) return
  setRuntimeSession(sessionId)
  queueMicrotask(() => {
    if (!adoptPersistedAnnotations(sessionId)) notify()
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
  const current = bySession.get(sessionId) ?? EMPTY
  const orphaned = bySession.get(MEMORY_KEY) ?? EMPTY

  const merged = new Map<string, SelectionAnnotation>()
  for (const item of stored) merged.set(item.id, item)
  for (const item of [...current, ...orphaned]) merged.set(item.id, item)

  const next = [...merged.values()]
  const sameAsCurrent =
    next.length === current.length && next.every((item, i) => item.id === current[i]?.id)
  if (sameAsCurrent && orphaned.length === 0) return false

  bySession.set(sessionId, next)
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

/**
 * Re-read a session after another tab wrote its storage key.
 *
 * Storage is the shared source of truth: every local mutation persists
 * synchronously, so this tab's memory can only be stale relative to it. The
 * stored array replaces the local one (last writer wins) — merging would
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
    if (changed) notify()
    return
  }
  if (!bySession.has(sessionId) && sessionId !== runtime.sessionId) return
  const stored = persistence.load(sessionId)
  const current = bySession.get(sessionId) ?? EMPTY
  if (sameAnnotations(stored, current)) return
  if (stored.length === 0) bySession.delete(sessionId)
  else bySession.set(sessionId, [...stored])
  notify()
}

export function annotationTitle(annotation: SelectionAnnotation): string {
  return previewTitle(annotation.text)
}
