/**
 * Strip the annotation protocol from host surfaces that paint the raw draft.
 *
 * On submit the host paints an optimistic bubble (`[data-submission-echo]`)
 * from the composer draft — which, at that instant, is the protocol block the
 * send gesture just folded in. A message submitted while a turn is running is
 * also previewed in the queue dock (`[data-queue-dock]`) from the same wire
 * content. Both are rendered by the chat flow itself, not by a
 * `conversation.chat.node` registration, so `UserMessageDisplay` never sees
 * them; without this, the raw JSON sits on screen until (or unless) a durable
 * message replaces it.
 *
 * The durable message keeps the block (the model needs it). This is display
 * only: the echo's protocol run is rewritten in place, and the queue preview's
 * word-split text container is rebuilt to the user's own text. The echo row
 * itself is never rebuilt (it may carry session chips); a truncated block is
 * left untouched, so nothing but our own protocol is edited.
 */

import { ANNOTATIONS_BLOCK_OPEN, ANNOTATIONS_BLOCK_CLOSE, scanAnnotatedMessage } from '../protocol/annotation-protocol.ts'

const ECHO_SELECTOR = '[data-submission-echo]'
const QUEUE_DOCK_SELECTOR = '[data-queue-dock]'
const SURFACE_SELECTOR = `${ECHO_SELECTOR}, ${QUEUE_DOCK_SELECTOR}`

/** The subset of DOM the stripper needs; keeps the logic testable without a DOM. */
export interface EchoNode {
  readonly children: ArrayLike<unknown>
  textContent: string | null
  querySelectorAll(selector: string): ArrayLike<EchoNode>
  /** DOM containment; stub implementations may omit it for flat trees. */
  contains?(node: EchoNode): boolean
}

function carriesProtocol(text: string): boolean {
  return text.includes(ANNOTATIONS_BLOCK_OPEN) && text.includes(ANNOTATIONS_BLOCK_CLOSE)
}

/** Deepest runs that carry both markers. A queue dock may carry one per row. */
function protocolRuns(row: EchoNode): EchoNode[] {
  // The row itself may be the text run (a bare element with no children).
  if (row.children.length === 0) {
    return carriesProtocol(row.textContent ?? '') ? [row] : []
  }
  const runs: EchoNode[] = []
  for (const el of Array.from(row.querySelectorAll('*'))) {
    if (el.children.length > 0) continue
    if (carriesProtocol(el.textContent ?? '')) runs.push(el)
  }
  return runs
}

/**
 * Rewrite one surface's protocol runs in place.
 *
 * Idempotent: once stripped a run no longer carries both markers, so a later
 * sweep (after the host re-renders the surface) is a no-op rather than a
 * reason to remember the node forever.
 */
export function stripEchoRow(row: EchoNode): boolean {
  let stripped = false
  for (const run of protocolRuns(row)) {
    const original = run.textContent ?? ''
    // A complete block is stripped whether or not its payload is readable: the
    // surface must never show protocol text.
    const scan = scanAnnotatedMessage(original)
    if (scan.rest === original) continue
    run.textContent = scan.rest
    stripped = true
  }
  return stripped
}

/**
 * Innermost text containers whose text carries a complete block.
 *
 * Queue previews go through the host's `conversation.user.text` factory, which
 * splits the draft into per-word spans; the open and close markers therefore
 * never share a leaf. The innermost ancestor holding both is the preview's
 * text container — rewriting that one leaves the row's icon and actions alone.
 */
function textContainers(surface: EchoNode): EchoNode[] {
  const all = Array.from(surface.querySelectorAll('*')).filter(
    (el) => el.children.length > 0 && carriesProtocol(el.textContent ?? ''),
  )
  return all.filter(
    (el) => !all.some((other) => other !== el && el.contains?.(other) === true),
  )
}

/**
 * Rewrite each queued row's text container in place. Unlike the echo, the
 * preview is a word-split run with no chips or attachments inside it, so
 * rebuilding that container is safe; the row itself is never touched.
 */
export function stripQueueDock(dock: EchoNode): boolean {
  let stripped = false
  for (const container of textContainers(dock)) {
    const original = container.textContent ?? ''
    const scan = scanAnnotatedMessage(original)
    if (scan.rest === original) continue
    container.textContent = scan.rest
    stripped = true
  }
  return stripped
}

/**
 * Watch for host surfaces that paint the composed draft and rewrite the
 * protocol block out of them. Runs once immediately, then only on mutations
 * that can affect one of those surfaces.
 */
export function watchSubmissionEcho(root?: ParentNode): () => void {
  const scope = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!scope) return () => {}
  const stripSurface = (surface: HTMLElement): void => {
    const node = surface as unknown as EchoNode
    if (surface.matches(QUEUE_DOCK_SELECTOR)) stripQueueDock(node)
    else stripEchoRow(node)
  }
  const sweep = (): void => {
    for (const surface of Array.from(scope.querySelectorAll<HTMLElement>(SURFACE_SELECTOR))) {
      stripSurface(surface)
    }
  }
  sweep()
  if (typeof MutationObserver === 'undefined') return () => {}

  // Coalesce to one pass per frame, but collect inside the observer callback:
  // after `frame` is set, later records still have to land in `pending`.
  const pending = new Set<HTMLElement>()
  let frame = 0
  const collect = (records: MutationRecord[]): void => {
    for (const record of records) {
      if (record.type === 'characterData') {
        const row = record.target.parentElement?.closest<HTMLElement>(SURFACE_SELECTOR)
        if (row) pending.add(row)
        continue
      }
      for (const node of Array.from(record.addedNodes)) {
        const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
        if (el === null) continue
        const row = el.closest<HTMLElement>(SURFACE_SELECTOR)
        if (row) {
          pending.add(row)
          continue
        }
        for (const inner of Array.from(el.querySelectorAll<HTMLElement>(SURFACE_SELECTOR))) {
          pending.add(inner)
        }
      }
    }
  }
  const observer = new MutationObserver((records) => {
    collect(records)
    // Idle surfaces (most mutation traffic) need no frame.
    if (pending.size === 0) return
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      for (const surface of pending) stripSurface(surface)
      pending.clear()
    })
  })
  observer.observe(scope, { childList: true, subtree: true, characterData: true })
  return () => {
    observer.disconnect()
    pending.clear()
    if (frame !== 0) window.cancelAnimationFrame(frame)
  }
}
