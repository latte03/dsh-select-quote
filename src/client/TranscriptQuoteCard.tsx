import type { ReactNode } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { ensureToolbarStyles, styles } from './styles.ts'
import type { SelectQuoteNodeData } from './transcript-node.ts'

export interface TranscriptQuoteCardProps {
  node: { data: SelectQuoteNodeData }
}

/**
 * Transcript card for the plugin-injected quotes of one user message.
 * Renders in the Chat node list; the same text remains in the user bubble so
 * the model still receives the full selection.
 */
export function TranscriptQuoteCard({ node }: TranscriptQuoteCardProps): ReactNode {
  ensureToolbarStyles()
  const quotes = node.data?.quotes ?? []
  if (quotes.length === 0) return null

  return jsx('div', {
    className: styles.tCardStack,
    children: quotes.map((quote, index) =>
      jsxs(
        'div',
        {
          className: styles.tCard,
          role: 'group',
          'aria-label': '选中的文本',
          children: [
            jsx('div', {
              className: styles.tCardIcon,
              'aria-hidden': true,
              children: 'AI',
            }),
            jsxs('div', {
              className: styles.tCardBody,
              children: [
                jsx('div', {
                  className: styles.tCardTitle,
                  title: quote.body,
                  children: quote.title,
                }),
                jsx('div', {
                  className: styles.tCardSubtitle,
                  children: '选中的文本',
                }),
              ],
            }),
          ],
        },
        `${index}`,
      ),
    ),
  })
}
