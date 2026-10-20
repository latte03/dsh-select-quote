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
const STRIPPED_ATTR = 'data-dsq-echo-stripped'

/** The deepest run that carries both markers, or null. */
function protocolRun(row: HTMLElement): HTMLElement | null {
  for (const el of row.querySelectorAll<HTMLElement>('*')) {
    if (el.children.length > 0) continue
    const text = el.textContent ?? ''
    if (text.includes(ANNOTATIONS_BLOCK_OPEN) && text.includes(ANNOTATIONS_BLOCK_CLOSE)) {
      return el
    }
  }
  return null
}

function strip(row: HTMLElement): void {
  if (row.hasAttribute(STRIPPED_ATTR)) return
  const run = protocolRun(row)
  if (run === null) return
  const scan = scanAnnotatedMessage(run.textContent ?? '')
  if (scan.annotations.length === 0) return
  run.textContent = scan.rest
  row.setAttribute(STRIPPED_ATTR, '')
}

/**
 * Watch for local submission echoes and rewrite the protocol block out of
 * them. Runs once immediately, then on every DOM insertion.
 */
export function watchSubmissionEcho(root?: ParentNode): () => void {
  const scope = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!scope) return () => {}
  const sweep = (): void => {
    for (const row of scope.querySelectorAll<HTMLElement>(ECHO_SELECTOR)) strip(row)
  }
  sweep()
  if (typeof MutationObserver === 'undefined') return () => {}
  // Coalesce: streaming replies mutate the transcript constantly, and the echo
  // only needs one pass per frame (still before paint, so it never flashes).
  let frame = 0
  const observer = new MutationObserver(() => {
    if (frame !== 0) return
    frame = window.requestAnimationFrame(() => {
      frame = 0
      sweep()
    })
  })
  observer.observe(scope, { childList: true, subtree: true })
  return () => {
    observer.disconnect()
    if (frame !== 0) window.cancelAnimationFrame(frame)
  }
}
