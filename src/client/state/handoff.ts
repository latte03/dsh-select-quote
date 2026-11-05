/**
 * Handoff records: a selection sent from one conversation into another.
 *
 * Outbound records live in the **source** session's partition and never enter
 * the pending-send path (`getAnnotations` / `clearAnnotations` / the send
 * intercept). The target session owns a normal pending annotation whose
 * `origin.handoffId` points back at one outbound record.
 *
 * Everything here is pure: ids, the stable selection key, the mark grouping and
 * the status labels. Storage and DOM live elsewhere.
 */

import type { AnnotationOrigin, AnnotationSource } from '../protocol/annotation-protocol.ts'

export type HandoffState = 'pending' | 'sent'

export interface HandoffDestination {
  readonly sessionId: string
  readonly kind: 'existing' | 'new'
  /** Title snapshot; render paths prefer the live session title. */
  readonly title: string
  readonly workspaceId?: string
}

export interface OutboundAnnotation {
  readonly id: string
  readonly text: string
  readonly comment?: string
  readonly sources: readonly AnnotationSource[]
  /** Stable key of the selected span; every target of it shares this key. */
  readonly selectionKey: string
  readonly destination: HandoffDestination
  readonly state: HandoffState
  readonly createdAt: number
  readonly updatedAt: number
}

/** One rendered arrow mark: every target that shares the same selection. */
export interface HandoffGroup {
  readonly selectionKey: string
  readonly markId: string
  readonly text: string
  readonly messageId: string
  readonly startOffset?: number
  readonly endOffset?: number
  readonly records: readonly OutboundAnnotation[]
}

/** 32-bit FNV-1a, base36; stable across reloads and independent of order. */
export function stableHash(value: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(36)
}

/**
 * `text + locator` identifies one physical selection. Two identical sentences
 * in different messages (or different offsets) must not merge, while the same
 * span sent to several targets must. Without a locator the text alone is the
 * best available key.
 */
export function selectionKeyOf(text: string, source?: AnnotationSource): string {
  const locator =
    source === undefined
      ? ''
      : [
          source.messageId ?? '',
          source.startOffset === undefined ? '' : String(source.startOffset),
          source.endOffset === undefined ? '' : String(source.endOffset),
        ].join(':')
  return `${text}\u0000${locator}`
}

/** Mark id shared by every outbound record of one selection. */
export function handoffMarkId(selectionKey: string): string {
  return `out_${stableHash(selectionKey)}`
}

/**
 * Mark id embedded in an outbound record id (`out_<hash>_<random>`). Jumps
 * back from a target annotate through the record id, so text/offset drift on
 * the target side cannot change which mark gets looked up.
 */
export function handoffMarkIdOf(handoffId: string): string {
  if (!handoffId.startsWith('out_')) return handoffId
  const at = handoffId.lastIndexOf('_')
  return at > 3 ? handoffId.slice(0, at) : handoffId
}

/** One outbound record id; doubles as `origin.handoffId`. */
export function newHandoffId(selectionKey: string): string {
  return `${handoffMarkId(selectionKey)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Group records by selection, newest first inside a group. */
export function groupHandoffs(
  records: readonly OutboundAnnotation[],
): readonly HandoffGroup[] {
  const groups = new Map<string, OutboundAnnotation[]>()
  for (const record of records) {
    const list = groups.get(record.selectionKey)
    if (list) list.push(record)
    else groups.set(record.selectionKey, [record])
  }
  const out: HandoffGroup[] = []
  for (const [selectionKey, group] of groups) {
    const sorted = [...group].sort((a, b) => a.createdAt - b.createdAt)
    const first = sorted[0]
    if (!first) continue
    const source = first.sources[0]
    out.push({
      selectionKey,
      markId: handoffMarkId(selectionKey),
      text: first.text,
      messageId: source?.messageId ?? '',
      ...(source?.startOffset === undefined ? {} : { startOffset: source.startOffset }),
      ...(source?.endOffset === undefined ? {} : { endOffset: source.endOffset }),
      records: sorted,
    })
  }
  return out
}

/** Handoff grouping for one mark id (a preview opened from the arrow badge). */
export function handoffGroupOf(
  records: readonly OutboundAnnotation[],
  markId: string,
): HandoffGroup | undefined {
  return groupHandoffs(records).find((group) => group.markId === markId)
}

/** Origin snapshot a target annotation carries for one outbound record. */
export function originOfHandoff(
  sourceSessionId: string,
  sourceTitle: string,
  handoffId: string,
): AnnotationOrigin {
  return { sessionId: sourceSessionId, title: sourceTitle, handoffId }
}

/**
 * Retention unit for an unsent handoff: newest `maxSessions` handoffs within
 * `maxAgeMs`, judged by the handoff's own timestamps rather than either
 * session key's `updatedAt`.
 */
export function handoffExpired(
  record: OutboundAnnotation,
  now: number,
  maxAgeMs: number,
): boolean {
  return now - record.updatedAt > maxAgeMs
}
