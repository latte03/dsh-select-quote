import type { ParsedAnnotation } from '../protocol/annotation-protocol.ts'

/**
 * Quotes rendered for a user message, keyed by that message's flow key.
 *
 * The durable annotation data lives in the user turn, but the chip that refers
 * to it lives in the assistant reply. The chip decorator walks the DOM; this
 * registry is how it resolves an ordinal back to the original text and comment
 * without re-parsing the protocol or exposing JSON in the DOM.
 */
const quotesByOwner = new Map<string, readonly ParsedAnnotation[]>()

export function registerMessageQuotes(
  ownerKey: string,
  quotes: readonly ParsedAnnotation[],
): () => void {
  quotesByOwner.set(ownerKey, quotes)
  return () => {
    // A remount registers a new array; only remove the entry this call owns.
    if (quotesByOwner.get(ownerKey) === quotes) quotesByOwner.delete(ownerKey)
  }
}

export function messageQuotes(ownerKey: string): readonly ParsedAnnotation[] | undefined {
  return quotesByOwner.get(ownerKey)
}
