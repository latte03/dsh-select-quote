/**
 * Strip the annotation protocol from the host's local submission echo.
 *
 * On submit the host paints an optimistic bubble (`[data-submission-echo]`)
 * from the composer draft — which, at that instant, is the protocol block the
 * send gesture just folded in. That echo is rendered by the chat flow itself,
 * not by a `conversation.chat.node` registration, so `UserMessageDisplay`
 * never sees it; with a slow model the raw JSON sits on screen until the
 * durable `user/message` event arrives.
 *
 * The durable message keeps the block (the model needs it). This is display
 * only: the echo's plain text run is rewritten to the user's own text. Any
 * other DOM shape (text split by session chips, a truncated block) is left
 * untouched rather than rebuilt, so nothing but our own protocol is edited.
 */

import { ANNOTATIONS_BLOCK_OPEN, ANNOTATIONS_BLOCK_CLOSE, scanAnnotatedMessage } from '../protocol/annotation-protocol.ts'

const ECHO_SELECTOR = '[data-submission-echo]'

/** The subset of DOM the stripper needs; keeps the logic testable without a DOM. */
export interface EchoNode {
  readonly children: ArrayLike<unknown>
  textContent: string | null
  querySelectorAll(selector: string): ArrayLike<EchoNode>
}

function carriesProtocol(text: string): boolean {
  return text.includes(ANNOTATIONS_BLOCK_OPEN) && text.includes(ANNOTATIONS_BLOCK_CLOSE)
}

/** The deepest run that carries both markers, or null. */
function protocolRun(row: EchoNode): EchoNode | null {
  // The row itself may be the text run (a bare element with no children).
  if (row.children.length === 0 && carriesProtocol(row.textContent ?? '')) return row
  for (const el of Array.from(row.querySelectorAll('*'))) {
    if (el.children.length > 0) continue
    if (carriesProtocol(el.textContent ?? '')) return el
  }
  return null
}

/**
 * Rewrite one echo row's protocol run in place.
 *
 * Idempotent: once stripped the run no longer carries both markers, so a
 * later sweep (after the host re-renders the row) is a no-op rather than a
 * reason to remember the row forever.
 */
export function stripEchoRow(row: EchoNode): boolean {
  const run = protocolRun(row)
  if (run === null) return false
  const original = run.textContent ?? ''
  // A complete block is stripped whether or not its payload is readable: the
  // echo must never show protocol text.
  const scan = scanAnnotatedMessage(original)
  if (scan.rest === original) return false
  run.textContent = scan.rest
  return true
}

/**
 * Watch for local submission echoes and rewrite the protocol block out of
 * them. Runs once immediately, then only on mutations that can affect an
 * echo row.
 */
export function watchSubmissionEcho(root?: ParentNode): () => void {
  const scope = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!scope) return () => {}
  const sweep = (): void => {
    for (const row of Array.from(scope.querySelectorAll<HTMLElement>(ECHO_SELECTOR))) stripEchoRow(row)
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
        const row = record.target.parentElement?.closest<HTMLElement>(ECHO_SELECTOR)
        if (row) pending.add(row)
        continue
      }
      for (const node of Array.from(record.addedNodes)) {
        const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement
        if (el === null) continue
        const row = el.closest<HTMLElement>(ECHO_SELECTOR)
        if (row) {
          pending.add(row)
          continue
        }
        for (const inner of Array.from(el.querySelectorAll<HTMLElement>(ECHO_SELECTOR))) pending.add(inner)
      }
    }
  }
  const observer = new MutationObserver((records) => {
    collect(records)
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      for (const row of pending) stripEchoRow(row)
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
