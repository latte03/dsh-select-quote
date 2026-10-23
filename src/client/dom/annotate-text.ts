/**
 * Inline annotation marks in message bodies.
 *
 * Every annotation (pending in the composer, or durable in a sent message)
 * resolves to a character range inside its source message. The range is
 * wrapped in a `.dsq_annMark` span — highlight underline plus a circular
 * ordinal badge — and kept in sync with the transcript through a
 * MutationObserver, because React re-renders replace the marked nodes.
 */

import { styles } from '../styles.ts'
import type { SelectionAnnotation } from '../state/annotation-store.ts'
import { BADGE_HEIGHT, BADGE_WIDTH, placeBadges } from './badge-layout.ts'
import { cleanTextOf, cleanTextRange, overlappingEntries } from './message-text.ts'

const MARK_ATTR = 'data-dsq-ann-mark'
const INDEX_ATTR = 'data-dsq-ann-index'
const FLASH_MS = 1500
/** Distance from the mark's bottom edge to the badge's bottom edge (CSS). */
const BADGE_BOTTOM = 8
const BADGE_MARGIN = 2

export interface AnnotationJob {
  /** Stable id of the mark; doubles as the summary item's scroll key. */
  readonly markId: string
  /** `data-chat-flow-key` of the message that owns the annotated text. */
  readonly messageId: string
  /** One-based annotation number shown in the badge. */
  readonly index: number
  readonly text: string
  readonly startOffset?: number
  readonly endOffset?: number
}

const jobs = new Map<string, AnnotationJob>()
let pendingIds = new Set<string>()

function attrValue(value: string): string {
  return value.replace(/["\\]/g, '\\$&')
}

function flowItems(messageId: string, scope: ParentNode): HTMLElement[] {
  if (messageId !== '') {
    const item = scope.querySelector(`[data-chat-flow-key="${attrValue(messageId)}"]`)
    return item instanceof HTMLElement ? [item] : []
  }
  // No durable locator (older wire format): search every rendered message.
  return [...scope.querySelectorAll('[data-chat-flow-key]')].filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  )
}

/**
 * Whitespace-insensitive comparison: `selection.toString()` inserts newlines
 * at block boundaries, while the clean-text concatenation has none, so both
 * sides are compared with all whitespace removed.
 */
function sameText(a: string, b: string): boolean {
  const norm = (value: string): string => value.replace(/\s+/g, '')
  return norm(a) === norm(b)
}

function isMarked(pieces: readonly { entry: { node: Text } }[]): boolean {
  const first = pieces[0]
  if (!first) return false
  return first.entry.node.parentElement?.closest(`[${MARK_ATTR}]`) != null
}

function createMark(job: AnnotationJob, withIndex: boolean): HTMLSpanElement {
  const mark = document.createElement('span')
  mark.className = styles.annMark
  mark.setAttribute(MARK_ATTR, job.markId)
  // Only the last fragment carries the ordinal, so the corner badge shows once.
  if (withIndex) mark.setAttribute(INDEX_ATTR, String(job.index))
  return mark
}

/**
 * Wrap `[from, to)` in marks. Each text-node fragment becomes its own span so
 * selections that cross inline elements or paragraph boundaries never reorder
 * the DOM; fragments of one annotation share the mark id, and the ordinal
 * badge rides on the final fragment (end of the annotation).
 *
 * `surroundContents` is load-bearing: `extractContents()` leaves the text
 * before **and after** the range in the same node, so inserting the mark at
 * `node.nextSibling` (the old implementation) appended every partial selection
 * to the end of its parent — a selection starting at offset 0, such as the
 * sentence after a colon, visibly jumped to the paragraph's end.
 */
function wrapRange(item: HTMLElement, job: AnnotationJob, from: number, to: number): boolean {
  const located = cleanTextRange(item, from, to)
  if (!located) return false
  const pieces = overlappingEntries(located.entries, located.from, located.to)
  if (pieces.length === 0) return false

  let wrapped = false
  pieces.forEach((piece, i) => {
    const node = piece.entry.node
    if (!node.parentElement) return
    const range = document.createRange()
    range.setStart(node, piece.start - piece.entry.start)
    range.setEnd(node, piece.end - piece.entry.start)
    const mark = createMark(job, i === pieces.length - 1)
    range.surroundContents(mark)
    wrapped = true
  })
  return wrapped
}

function decorateAtOffsets(item: HTMLElement, job: AnnotationJob): boolean {
  if (job.startOffset === undefined || job.endOffset === undefined) return false
  const located = cleanTextRange(item, job.startOffset, job.endOffset)
  if (!located) return false
  if (!sameText(cleanTextOf(item).slice(located.from, located.to), job.text)) return false
  const pieces = overlappingEntries(located.entries, located.from, located.to)
  if (pieces.length === 0 || isMarked(pieces)) return false
  return wrapRange(item, job, located.from, located.to)
}

function decorateBySearch(item: HTMLElement, job: AnnotationJob): boolean {
  const full = cleanTextOf(item)
  const needle = job.text.trim()
  if (needle.length < 2) return false
  // Second pattern tolerates block boundaries: selection text carries newlines
  // the DOM concatenation does not, so words may adjoin with zero whitespace.
  // It must be a real RegExp — `indexOf` would search for the literal "\s*".
  const patterns = [
    new RegExp(escapeRegExp(needle), 'g'),
    new RegExp(needle.split(/\s+/).map(escapeRegExp).join('\\s*'), 'g'),
  ]
  for (const pattern of patterns) {
    for (const match of full.matchAll(pattern)) {
      const at = match.index ?? 0
      const length = match[0].length
      if (length === 0) continue
      const located = cleanTextRange(item, at, at + length)
      if (located) {
        const pieces = overlappingEntries(located.entries, located.from, located.to)
        if (pieces.length > 0 && !isMarked(pieces) && wrapRange(item, job, located.from, located.to)) {
          return true
        }
      }
    }
  }
  return false
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function decorateJob(item: HTMLElement, job: AnnotationJob): boolean {
  if (decorateAtOffsets(item, job)) return true
  return decorateBySearch(item, job)
}

/**
 * Existing marks are kept, but their ordinal is owned by the job: removing an
 * earlier annotation renumbers the rest without re-wrapping the text. Only the
 * final fragment carries the badge.
 */
function refreshMarkIndex(item: HTMLElement, job: AnnotationJob): boolean {
  const marks = Array.from(
    item.querySelectorAll<HTMLElement>(`[${MARK_ATTR}="${attrValue(job.markId)}"]`),
  )
  if (marks.length === 0) return false
  const last = marks[marks.length - 1]
  const next = String(job.index)
  if (last.getAttribute(INDEX_ATTR) !== next) last.setAttribute(INDEX_ATTR, next)
  return true
}

/**
 * Resolve overlapping ordinal badges. Two annotations can end at the same
 * offset (nested ranges), which puts their pseudo-element badges on the same
 * pixel; nearby ends can also touch. Measure every last fragment, then write
 * the offset back as variables inherited by `::after`. The badge's transform
 * never participates in text layout.
 */
function layoutBadges(scope: ParentNode): void {
  const marks = Array.from(scope.querySelectorAll<HTMLElement>(`[${INDEX_ATTR}]`))
  for (const mark of marks) {
    mark.style.removeProperty('--dsq-ann-badge-x')
    mark.style.removeProperty('--dsq-ann-badge-y')
  }
  if (marks.length < 2) return
  const scroller = marks[0]?.closest('[data-conversation-scroll]')
  const scrollerRect = scroller instanceof Element ? scroller.getBoundingClientRect() : null
  const rightEdge =
    scrollerRect && scrollerRect.width > 0
      ? scrollerRect.right
      : document.documentElement.clientWidth
  const topEdge = scrollerRect && scrollerRect.height > 0 ? scrollerRect.top : 0
  const anchors = marks
    .map((mark) => {
      const rect = mark.getBoundingClientRect()
      return {
        mark,
        index: Number(mark.getAttribute(INDEX_ATTR) ?? 0),
        x: rect.right + BADGE_MARGIN,
        y: rect.bottom - BADGE_BOTTOM - BADGE_HEIGHT,
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
        visible: rect.width > 0 && rect.height > 0,
      }
    })
    .filter((anchor) => anchor.visible)
    .sort((a, b) => a.index - b.index)
  if (anchors.length < 2) return
  const offsets = placeBadges(anchors, { right: rightEdge - 4, top: topEdge + 4 })
  anchors.forEach((anchor, i) => {
    const { dx, dy } = offsets[i]
    if (dx !== 0) anchor.mark.style.setProperty('--dsq-ann-badge-x', `${dx}px`)
    if (dy !== 0) anchor.mark.style.setProperty('--dsq-ann-badge-y', `${dy}px`)
  })
}

/** Apply every registered job whose message is currently rendered. */
export function applyAnnotationMarks(root?: ParentNode): void {
  if (jobs.size === 0) return
  const scope = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!scope) return
  for (const job of [...jobs.values()]) {
    const items = flowItems(job.messageId, scope)
    let decorated = false
    for (const item of items) {
      // Refresh every rendered copy that already carries the mark, including
      // copies after the first one that owns the decoration.
      if (refreshMarkIndex(item, job)) {
        decorated = true
        continue
      }
      if (decorated) continue
      // Cheap pre-filter for locator-less jobs, which scan every message.
      if (job.messageId === '' && !item.textContent?.includes(job.text.trim().slice(0, 16))) {
        continue
      }
      if (decorateJob(item, job)) decorated = true
    }
  }
  layoutBadges(scope)
}

/** Insert or refresh jobs; identical jobs are no-ops. */
export function upsertAnnotationJobs(next: readonly AnnotationJob[]): void {
  let changed = false
  for (const job of next) {
    const prev = jobs.get(job.markId)
    if (
      prev &&
      prev.messageId === job.messageId &&
      prev.index === job.index &&
      prev.text === job.text &&
      prev.startOffset === job.startOffset &&
      prev.endOffset === job.endOffset
    ) {
      continue
    }
    jobs.set(job.markId, job)
    changed = true
  }
  if (changed) applyAnnotationMarks()
}

function unwrapMarks(markId: string): void {
  const marks = document.querySelectorAll(`[${MARK_ATTR}="${attrValue(markId)}"]`)
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }
}

/** Drop jobs and unwrap their marks (annotation removed). */
export function dropAnnotationJobs(ids: readonly string[]): void {
  let changed = false
  for (const id of ids) {
    if (jobs.delete(id)) {
      unwrapMarks(id)
      changed = true
    }
  }
  if (changed) applyAnnotationMarks()
}

/** Diff the pending store into jobs; call on every annotation-store change. */
export function syncPendingAnnotationJobs(annotations: readonly SelectionAnnotation[]): void {
  const next = new Set(annotations.map((item) => item.id))
  const removed = [...pendingIds].filter((id) => !next.has(id))
  pendingIds = next
  if (removed.length > 0) dropAnnotationJobs(removed)
  upsertAnnotationJobs(
    annotations.map((item, i) => ({
      markId: item.id,
      messageId: item.sources[0]?.messageId ?? '',
      index: i + 1,
      text: item.text,
      startOffset: item.sources[0]?.startOffset,
      endOffset: item.sources[0]?.endOffset,
    })),
  )
}

/** Observe the transcript and re-apply marks after re-renders. Returns disposer. */
export function watchAnnotationMarks(root?: ParentNode): () => void {
  const el = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!el || typeof MutationObserver === 'undefined') return () => {}
  applyAnnotationMarks(el)
  let frame = 0
  const schedule = (): void => {
    // Nothing to maintain until a job exists; upsert applies synchronously.
    if (jobs.size === 0) return
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      applyAnnotationMarks(el)
    })
  }
  const observer = new MutationObserver(schedule)
  observer.observe(el, { childList: true, subtree: true })
  // Line wrapping changes without a relevant mutation when the window or a
  // side panel resizes; both can move the anchors under the badges.
  const onResize = (): void => schedule()
  window.addEventListener('resize', onResize)
  return () => {
    observer.disconnect()
    window.removeEventListener('resize', onResize)
    if (frame !== 0) window.cancelAnimationFrame(frame)
  }
}

/** Mark for an annotation number, optionally restricted to `markId`. */
export function findAnnotationMark(
  index: number,
  text?: string,
  markId?: string,
): HTMLElement | null {
  if (markId) {
    const direct = document.querySelector(`[${MARK_ATTR}="${attrValue(markId)}"]`)
    if (direct instanceof HTMLElement) return direct
  }
  const marks = [...document.querySelectorAll(`[${INDEX_ATTR}="${index}"]`)].filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  )
  if (marks.length === 0) return null
  if (text) {
    const hit = marks.find((mark) => sameText(mark.textContent ?? '', text))
    if (hit) return hit
  }
  return marks[0]
}

/**
 * Mark for an annotation number that sits at or before `anchor` in the
 * transcript — the annotation belongs to the user turn preceding the reply
 * that references it.
 */
export function findAnnotationMarkBefore(index: number, anchor: HTMLElement): HTMLElement | null {
  const marks = [...document.querySelectorAll(`[${INDEX_ATTR}="${index}"]`)].filter(
    (node): node is HTMLElement => node instanceof HTMLElement,
  )
  if (marks.length === 0) return null
  const before = marks.filter((mark) => {
    if (mark === anchor) return true
    return (mark.compareDocumentPosition(anchor) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  })
  return before[before.length - 1] ?? marks[0]
}

/** Scroll a mark into view and flash it. */
export function flashAnnotationMark(mark: HTMLElement): void {
  mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
  mark.classList.add(styles.annMarkFlash)
  window.setTimeout(() => mark.classList.remove(styles.annMarkFlash), FLASH_MS)
}
