/**
 * Draft writes that do not rebuild the editor document.
 *
 * dsh 0.2.2 replaced the plain `contentEditable` composer with a Lexical
 * editor. `inputActions.setDraft(text)` is implemented as
 * `root.clear()` + rebuild, which silently drops every atomic node in the
 * draft — most visibly the host's own `QuoteNode`, i.e. a quote the user took
 * from the transcript before adding an annotation. It also rewrites the whole
 * document on every marker write, which makes an unrelated pending send change
 * shape under the user.
 *
 * The host exposes an append-only verb next to it:
 * `captureInsertion()` → `{start, end, draftRev}` and
 * `insertText(text, span)` (rejected when `span.draftRev` no longer matches the
 * live revision). Bare text goes through `$replaceDetectSpanWithText`, which
 * edits in place and leaves every other node alone.
 *
 * This module owns the decision of *which* verb to use and keeps that decision
 * testable without a DOM.
 */

/** The slice of the host's `inputActions` this plugin writes through. */
export interface InputActionsFace {
  setDraft(text: string): void
  /** dsh 0.2.2+; absent on older hosts. */
  captureInsertion?(): { start: number; end: number; draftRev: number }
  /** dsh 0.2.2+; absent on older hosts. */
  insertText?(text: string, span: { start: number; end: number; draftRev: number }): boolean
}

/**
 * Replace the draft text without clearing atomic nodes when the host supports
 * an append-only edit.
 *
 * `current` is the draft the caller read before computing `next`; on a Lexical
 * host a revision mismatch simply returns false and the caller falls back.
 */
export function writeDraft(actions: InputActionsFace, next: string, current: string): boolean {
  if (next === current) return true
  const capture = actions.captureInsertion
  const insert = actions.insertText
  if (typeof capture === 'function' && typeof insert === 'function') {
    const span = capture()
    // Only a full-document rewrite is expressible as one in-place edit. A
    // partial change would need a real diff, which risks landing mid-grapheme.
    const whole =
      span.start === 0 &&
      span.end === current.length &&
      typeof span.draftRev === 'number'
    if (whole && insert.call(actions, next, span)) return true
  }
  actions.setDraft(next)
  return false
}

/** Append text at the caret without touching any existing node. */
export function appendDraftText(actions: InputActionsFace, text: string): boolean {
  if (text === '') return true
  const capture = actions.captureInsertion
  const insert = actions.insertText
  if (typeof capture !== 'function' || typeof insert !== 'function') {
    actions.setDraft(text)
    return false
  }
  const span = capture()
  // Insert at a collapsed caret only: replacing a live selection would eat the
  // user's own text.
  if (span.start !== span.end) return false
  return insert.call(actions, text, span)
}
