import { DRAFT_MARKER, stripDraftMarker, withDraftMarker } from '../protocol/quote-protocol.ts'

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
