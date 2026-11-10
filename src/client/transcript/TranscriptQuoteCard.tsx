import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { upsertAnnotationJobs } from '../dom/annotate-text.ts'
import { scrollToAnnotation } from '../dom/scrollToAnnotation.ts'
import { t } from '../i18n.ts'
import {
  isSessionArchived,
  openSourceAndLocate,
  sessionTitleOf,
} from '../selection/navigation.ts'
import { showToast } from '../ui/toast.ts'
import { ensureToolbarStyles, styles } from '../styles.ts'
import { handoffMarkIdOf } from '../state/handoff.ts'
import type { ParsedAnnotation } from '../protocol/annotation-protocol.ts'
import { AnnotationSummary, type AnnotationSummaryItem } from '../ui/AnnotationCardView.tsx'
import { registerMessageQuotes } from './quote-registry.ts'

/** View payload a user message's annotation summary is rendered from. */
export interface SelectQuoteNodeData {
  readonly quotes: readonly ParsedAnnotation[]
}

export interface TranscriptQuoteCardProps {
  node: { data: SelectQuoteNodeData }
  /** Side-question marks paint a bot glyph instead of the ordinal. */
  robot?: boolean
  /** The turn this message opened is still being answered (drives the whale). */
  running?: boolean
}

/**
 * History-side summary for one user message's annotations.
 *
 * One block per message, not one card per annotation: the block carries the
 * count and the hover list shows every annotation with its selected text and
 * comment. That is the same shape the composer uses for pending selections, so
 * a message reads the same before and after it is sent. Clicking an item
 * scrolls back to the marked text in the source message; the ordinal badge
 * matches the `:dsh-annotation{index="N"}` the model refers to.
 */
export function TranscriptQuoteCard({
  node,
  robot = false,
  running = false,
}: TranscriptQuoteCardProps): ReactNode {
  ensureToolbarStyles()
  const stackRef = useRef<HTMLDivElement | null>(null)
  const quotes = node.data?.quotes ?? []

  // Mark the annotated text inside the source messages. The mark id embeds
  // this message's own flow key so quotes from different turns never collide.
  //
  // Quotes with `origin` were selected in another conversation: their offsets
  // cannot resolve here, and searching by text would paint an unrelated
  // paragraph. They keep their card row and chip index but draw no mark.
  useEffect(() => {
    if (quotes.length === 0) return
    const ownerKey = stackRef.current?.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key')
    upsertAnnotationJobs(
      quotes
        .map((quote, index) => ({ quote, index }))
        .filter(({ quote }) => quote.origin === undefined)
        .map(({ quote, index }) => ({
          markId: ownerKey ? `dqsm_${ownerKey}_${index}` : `dqsm_q${index}`,
          messageId: quote.messageId ?? '',
          index: index + 1,
          text: quote.text,
          startOffset: quote.startOffset,
          endOffset: quote.endOffset,
          ...(robot ? { variant: 'robot' as const } : {}),
        })),
    )
  }, [quotes])

  // Chips in the assistant reply resolve their ordinal through this registry;
  // keep it in sync with what this message's marks were built from.
  useEffect(() => {
    if (quotes.length === 0) return
    const ownerKey = stackRef.current?.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key')
    if (!ownerKey) return
    return registerMessageQuotes(ownerKey, quotes)
  }, [quotes])

  const markIdOf = useCallback((index: number): string | undefined => {
    const ownerKey = stackRef.current?.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key')
    return ownerKey ? `dqsm_${ownerKey}_${index}` : undefined
  }, [])

  const onSelect = useCallback(
    (index: number, _item: AnnotationSummaryItem) => {
      const quote = quotes[index]
      if (quote === undefined) return
      if (quote.origin) {
        const live = sessionTitleOf(quote.origin.sessionId, quote.origin.title)
        if (isSessionArchived(quote.origin.sessionId)) {
          showToast(t('handoff.archived', { title: live }))
          return
        }
        openSourceAndLocate({
          sessionId: quote.origin.sessionId,
          text: quote.text,
          ...(quote.origin.handoffId
            ? { markId: handoffMarkIdOf(quote.origin.handoffId) }
            : {}),
          ...(quote.messageId
            ? {
                sources: [
                  {
                    text: quote.text,
                    messageId: quote.messageId,
                    startOffset: quote.startOffset,
                    endOffset: quote.endOffset,
                  },
                ],
              }
            : {}),
        })
        return
      }
      scrollToAnnotation(index + 1, quote.text, markIdOf(index))
    },
    [markIdOf, quotes],
  )

  /**
   * "From: <source>" opens the conversation this annotation was selected in.
   *
   * The composer card has always wired this; the history card rendered the same
   * button from `item.origin` but passed no handler, so the link was visibly
   * there and did nothing. A cross-session item has no mark in THIS transcript
   * by design, so the origin jump is the only way back to its source.
   */
  const onOrigin = useCallback(
    (index: number, _item: AnnotationSummaryItem) => {
      const quote = quotes[index]
      const origin = quote?.origin
      if (origin === undefined) return
      const live = sessionTitleOf(origin.sessionId, origin.title)
      if (isSessionArchived(origin.sessionId)) {
        showToast(t('handoff.archived', { title: live }))
        return
      }
      openSourceAndLocate({
        sessionId: origin.sessionId,
        text: quote.text,
        ...(origin.handoffId ? { markId: handoffMarkIdOf(origin.handoffId) } : {}),
      })
    },
    [quotes],
  )

  if (quotes.length === 0) return null

  return (
    <div ref={stackRef} className={styles.tSummary} data-dsq-deco="true">
      <AnnotationSummary
        count={quotes.length}
        items={quotes.map((quote, index) => ({
          id: `dqsm-${index}`,
          title: quote.title,
          text: quote.text,
          ...(quote.comment ? { comment: quote.comment } : {}),
          ...(quote.origin
            ? {
                origin: {
                  sessionId: quote.origin.sessionId,
                  title: sessionTitleOf(quote.origin.sessionId, quote.origin.title),
                  archived: isSessionArchived(quote.origin.sessionId),
                },
              }
            : {}),
        }))}
        running={running}
        onItemSelect={onSelect}
        onItemOrigin={onOrigin}
      />
    </div>
  )
}
