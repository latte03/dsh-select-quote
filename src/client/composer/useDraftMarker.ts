import { DRAFT_MARKER, stripDraftMarker, withDraftMarker } from '../protocol/quote-protocol.ts'

/**
 * True when the draft is nothing but the legacy invisible send marker.
 *
 * The plugin used to append U+200B so an annotation-only draft looked non-empty
 * and the Host's send button stayed enabled. That is gone: it made sending a
 * wordless message possible, and a Host-rendered bubble for such a message is
 * an empty box. Older persisted drafts may still carry the character, so the
 * composer distinguishes "only the marker" (empty the draft) from "marker next
 * to real text" (strip the marker, keep the text).
 */
export function isMarkerOnly(draft: string): boolean {
  return draft.includes(DRAFT_MARKER) && stripDraftMarker(draft).trim() === ''
}

/**
 * Keep the Host's send affordances enabled exactly while annotations are pending.
 *
 * The Host disables the primary send button and Enter on an empty draft, so an
 * annotation-only message could never reach the send intercept. A zero-width
 * marker makes the draft non-empty; the submit path strips it, and the userText
 * rule hides the protocol block, so the bubble is empty and only the quote card
 * shows.
 *
 * Returns the draft to write, or `null` when the current draft is already right.
 * Only the composer owns the write: keeping this pure makes the cases testable
 * without a DOM.
 */
export function reconcileDraftMarker(draft: string, pending: number): string | null {
  const marked = draft.includes(DRAFT_MARKER)
  if (pending === 0) return marked ? stripDraftMarker(draft) : null
  // Real words already keep the composer non-empty; the marker is not needed.
  if (stripDraftMarker(draft).trim() !== '') return null
  return marked ? null : withDraftMarker(draft)
}
