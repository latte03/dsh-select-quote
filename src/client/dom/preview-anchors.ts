/**
 * DOM anchors for the chip preview: which message owns a mark/chip, and how to
 * land on the card that carries the quote.
 *
 * Pure DOM lookups over the host's transcript attributes; no preview state.
 */

import { styles } from '../styles.ts'
import { messageQuotes } from '../transcript/quote-registry.ts'

/**
 * The annotated text can sit in an earlier assistant turn while the quotes were
 * serialized into the user turn that sent them. The mark id is built by
 * `TranscriptQuoteCard` as `dqsm_<ownerFlowKey>_<zeroBasedIndex>`, so it — not
 * the mark's physical ancestor — names the message that owns the quotes.
 */
export function quotesOwnerOf(mark: HTMLElement | null): string | null {
  if (!mark) return null
  const id = mark.getAttribute('data-dsq-ann-mark') ?? ''
  const match = /^dqsm_(.+)_\d+$/.exec(id)
  return match ? match[1] : null
}

/** The quote card for the user turn that sent the annotation, before the chip. */
export function quotesOwnerBefore(chip: HTMLElement, index: number): string | null {
  const cards = [...document.querySelectorAll<HTMLElement>('.dsq_tSummary')]
  for (let i = cards.length - 1; i >= 0; i -= 1) {
    const card = cards[i]
    if ((card.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) continue
    const ownerKey = card.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key')
    if (ownerKey && messageQuotes(ownerKey)?.[index - 1]) return ownerKey
  }
  return null
}

export function markByOwner(ownerKey: string, index: number): HTMLElement | null {
  const id = `dqsm_${ownerKey}_${index - 1}`
  const marks = [...document.querySelectorAll<HTMLElement>('[data-dsq-ann-mark]')].filter(
    (mark) => mark.getAttribute('data-dsq-ann-mark') === id,
  )
  return (
    marks.find((mark) => mark.getAttribute('data-dsq-ann-index') === String(index)) ??
    marks[0] ??
    null
  )
}

export function flowItem(messageId: string): HTMLElement | null {
  for (const item of document.querySelectorAll<HTMLElement>('[data-chat-flow-key]')) {
    if (item.getAttribute('data-chat-flow-key') === messageId) return item
  }
  return null
}

export function quoteCardFor(ownerKey: string): HTMLElement | null {
  for (const card of document.querySelectorAll<HTMLElement>('.dsq_tSummary')) {
    if (card.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key') === ownerKey) {
      return card
    }
  }
  return null
}

export function isVisible(el: HTMLElement | null): el is HTMLElement {
  if (!el?.isConnected) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function flashMessage(el: HTMLElement): void {
  el.classList.add(styles.annMessageFlash)
  window.setTimeout(() => el.classList.remove(styles.annMessageFlash), 1400)
}
