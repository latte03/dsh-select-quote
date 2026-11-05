import { DRAFT_MARKER, stripDraftMarker } from '../protocol/quote-protocol.ts'

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
