import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import {
  DRAFT_MARKER,
  clearQuotes,
  composeSubmission,
  getQuotes,
  removeQuote,
  stripDraftMarker,
  subscribeQuotes,
  withDraftMarker,
  type StoredQuote,
} from './quote-store.ts'
import { ensureToolbarStyles, styles } from './styles.ts'

export interface QuoteCardProps {
  useInput: <T>(selector: (state: { draft: string; draftRev: number }) => T) => T
  inputActions: {
    setDraft(text: string): void
  }
  sessionId?: string
}

/** The resident composer card that owns the draft surface. */
const COMPOSER_CARD = '[data-composer-card]'

const NO_QUOTES: readonly StoredQuote[] = []

function composerCardOf(node: Element): HTMLElement | null {
  const card = node.closest(COMPOSER_CARD)
  return card instanceof HTMLElement ? card : null
}

/**
 * A composer card is non-empty when it holds visible draft text or a draft
 * attachment — the two states in which the composer's own send gesture
 * actually submits.
 */
function willSubmit(card: HTMLElement, draft: string): boolean {
  return draft.trim().length > 0 || card.querySelector('img') !== null
}

/**
 * The quote card stack inside the composer card (`conversation.input.overlay`).
 *
 * Selections never enter the editor as text: the cards are the only thing the
 * user sees, and the markdown blocks are folded into the draft one capture-phase
 * step before the composer's own send handler reads it.
 */
export function QuoteCard({ useInput, inputActions, sessionId }: QuoteCardProps): ReactNode {
  const draft = useInput((state) => state.draft)
  const [quotes, setQuotes] = useState<readonly StoredQuote[]>(NO_QUOTES)
  const stackRef = useRef<HTMLDivElement | null>(null)
  const draftRef = useRef(draft)
  const actionsRef = useRef(inputActions)
  const sessionRef = useRef(sessionId)
  draftRef.current = draft
  actionsRef.current = inputActions
  sessionRef.current = sessionId

  const sync = useCallback(() => {
    const id = sessionRef.current
    setQuotes(id ? getQuotes(id) : NO_QUOTES)
  }, [])

  useEffect(() => {
    ensureToolbarStyles()
    sync()
    return subscribeQuotes(sync)
  }, [sync, sessionId])

  // Reserve the stack's height inside the composer so the attachment rail and
  // the editor flow below it instead of being covered by the floating cards.
  useEffect(() => {
    const element = stackRef.current
    if (!element) return
    const card = composerCardOf(element)
    if (!card) return
    const apply = (): void => {
      card.style.setProperty('--dsq-quote-pad', `${element.offsetHeight + 20}px`)
    }
    card.classList.add(styles.cardPad)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(element)
    return () => {
      observer.disconnect()
      card.classList.remove(styles.cardPad)
      card.style.removeProperty('--dsq-quote-pad')
    }
  }, [quotes])

  // Keep the composer's own send button usable while only quotes are pending:
  // an invisible marker makes an otherwise empty draft non-empty.
  //
  // It is written ONCE per quote-list change — never on a draft change. Rewriting
  // the editor in response to the draft fights the user: backspacing through the
  // marker would immediately restore it (so deletion looks broken), and an
  // in-flight IME composition would be destroyed mid-keystroke.
  useEffect(() => {
    if (quotes.length === 0 || !sessionId) return
    const current = draftRef.current
    if (current.includes(DRAFT_MARKER)) return
    // Draft text already keeps the composer submittable; no marker needed.
    if (current.trim() !== '') return
    actionsRef.current.setDraft(withDraftMarker(current))
  }, [quotes, sessionId])

  /**
   * Fold every quote into the draft at the send gesture: Enter (without
   * modifiers, outside IME composition) inside the composer editor, or the
   * composer's own primary action. Both are intercepted on `document` in the
   * capture phase, so the draft already carries the blocks when the composer
   * submits it, and the cards disappear at the same moment.
   */
  useEffect(() => {
    const id = sessionId
    if (quotes.length === 0 || !id) return

    const inject = (): void => {
      const current = getQuotes(id)
      if (current.length === 0) return
      const blocks = current.map((quote) => quote.draftBlock)
      actionsRef.current.setDraft(composeSubmission(draftRef.current, blocks))
      clearQuotes(id)
      setQuotes(NO_QUOTES)
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Enter' || event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.isComposing) return
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.isContentEditable) return
      const card = composerCardOf(target)
      if (!card || !willSubmit(card, draftRef.current)) return
      inject()
    }

    const onClick = (event: MouseEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      const card = composerCardOf(target)
      if (!card) return
      // A disabled primary means the composer itself has nothing to send.
      const button = target.closest('button')
      if (!button || (button as HTMLButtonElement).disabled) return
      // The composer's primary seat is its last button; it renders the stop
      // control (a filled square) instead of submit while a turn runs.
      const buttons = card.querySelectorAll('button')
      if (buttons.length === 0 || buttons[buttons.length - 1] !== button) return
      if (button.querySelector('svg rect') !== null) return
      inject()
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [quotes, sessionId])

  const onRemove = useCallback((id: string) => {
    const active = sessionRef.current
    if (!active) return
    removeQuote(active, id)
    const rest = getQuotes(active)
    setQuotes(rest)
    // The last card takes the invisible send marker with it.
    if (rest.length === 0) actionsRef.current.setDraft(stripDraftMarker(draftRef.current))
  }, [])

  if (!sessionId || quotes.length === 0) return null

  return jsx('div', {
    ref: stackRef,
    className: styles.cardStack,
    children: quotes.map((quote) =>
      jsxs(
        'div',
        {
          className: styles.card,
          role: 'group',
          'aria-label': '选中的文本',
          children: [
            jsx('div', {
              className: styles.cardIcon,
              'aria-hidden': true,
              children: 'AI',
            }),
            jsxs('div', {
              className: styles.cardBody,
              children: [
                jsx('div', {
                  className: styles.cardTitle,
                  title: quote.text,
                  children: quote.title,
                }),
                jsx('div', {
                  className: styles.cardSubtitle,
                  children: '选中的文本',
                }),
              ],
            }),
            jsx('button', {
              type: 'button',
              className: styles.cardClose,
              'aria-label': '移除引用',
              onClick: () => onRemove(quote.id),
              children: '×',
            }),
          ],
        },
        quote.id,
      ),
    ),
  })
}
