import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { jsx } from 'react/jsx-runtime'
import { upsertAnnotationJobs } from '../dom/annotate-text.ts'
import { scrollToAnnotation } from '../dom/scrollToAnnotation.ts'
import { ensureToolbarStyles, styles } from '../styles.ts'
import type { ParsedAnnotation } from '../protocol/annotation-protocol.ts'
import { AnnotationCardView } from '../ui/AnnotationCardView.tsx'

/** View payload a user message's cards are rendered from. */
export interface SelectQuoteNodeData {
  readonly quotes: readonly ParsedAnnotation[]
  readonly seq: number
}

export interface TranscriptQuoteCardProps {
  node: { data: SelectQuoteNodeData }
}

/**
 * History-side cards for one user message's annotations.
 *
 * One card per annotation, each showing the selected text **and** the user's
 * comment. The comment is how the user recognizes their own annotation, so it
 * belongs on the visible card — not behind a hover panel that has to be
 * discovered. Clicking a card scrolls back to the marked text in the source
 * message; the ordinal badge matches the `:dsh-annotation{index="N"}` the model
 * refers to.
 */
export function TranscriptQuoteCard({ node }: TranscriptQuoteCardProps): ReactNode {
  ensureToolbarStyles()
  const stackRef = useRef<HTMLDivElement | null>(null)
  const quotes = node.data?.quotes ?? []

  // Mark the annotated text inside the source messages. The mark id embeds
  // this message's own flow key so quotes from different turns never collide.
  useEffect(() => {
    if (quotes.length === 0) return
    const ownerKey = stackRef.current?.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key')
    upsertAnnotationJobs(
      quotes.map((quote, index) => ({
        markId: ownerKey ? `dqsm_${ownerKey}_${index}` : `dqsm_q${index}`,
        messageId: quote.messageId ?? '',
        index: index + 1,
        text: quote.text,
        startOffset: quote.startOffset,
        endOffset: quote.endOffset,
      })),
    )
  }, [quotes])

  const markIdOf = useCallback((index: number): string | undefined => {
    const ownerKey = stackRef.current?.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key')
    return ownerKey ? `dqsm_${ownerKey}_${index}` : undefined
  }, [])

  const onSelect = useCallback(
    (index: number, text: string) => {
      scrollToAnnotation(index + 1, text, markIdOf(index))
    },
    [markIdOf],
  )

  if (quotes.length === 0) return null

  return jsx('div', {
    ref: stackRef,
    className: styles.tCardStack,
    'data-dsq-deco': 'true',
    children: quotes.map((quote, index) =>
      jsx(
        'div',
        {
          className: styles.tCardButton,
          role: 'button',
          tabIndex: 0,
          'aria-label': quote.title,
          onClick: () => onSelect(index, quote.text),
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            onSelect(index, quote.text)
          },
          children: jsx(AnnotationCardView, {
            variant: 'transcript',
            title: quote.title,
            text: quote.text,
            comment: quote.comment || undefined,
            index: index + 1,
          }),
        },
        `ann-${index}`,
      ),
    ),
  })
}