import { useEffect, type MutableRefObject } from 'react'
import { DRAFT_MARKER, stripDraftMarker, withDraftMarker } from '../protocol/quote-protocol.ts'

export interface DraftMarkerDeps {
  readonly itemCount: number
  readonly draftRef: MutableRefObject<string>
  readonly setDraft: (text: string) => void
}

/**
 * Keep the composer's own send button usable while only annotations are
 * pending: an invisible marker makes an otherwise empty draft non-empty.
 *
 * Written ONCE per list change — never on a draft change (see QuoteCard history
 * for why rewriting on draft fights IME / backspace).
 */
export function useDraftMarker({
  itemCount,
  draftRef,
  setDraft,
}: DraftMarkerDeps): void {
  useEffect(() => {
    if (itemCount === 0) return
    const current = draftRef.current
    if (current.includes(DRAFT_MARKER)) return
    if (current.trim() !== '') return
    setDraft(withDraftMarker(current))
  }, [itemCount, draftRef, setDraft])
}

export function clearDraftMarker(draft: string, setDraft: (text: string) => void): void {
  if (!draft.includes(DRAFT_MARKER)) return
  setDraft(stripDraftMarker(draft))
}

/**
 * True when the draft is nothing but the invisible send marker.
 *
 * `setDraft('')` on a Lexical host clears the whole document, so an empty
 * marker-only draft must be *emptied*, not rewritten with the marker removed:
 * a rewrite that clears and rebuilds would also drop the user's quote nodes.
 */
export function isMarkerOnly(draft: string): boolean {
  return draft.includes(DRAFT_MARKER) && stripDraftMarker(draft).trim() === ''
}
