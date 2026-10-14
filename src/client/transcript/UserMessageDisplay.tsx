import type { ReactNode } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import {
  parseAnnotatedMessage,
  scanAnnotatedMessage,
} from '../protocol/annotation-protocol.ts'
import { contentBlocksToText, displayTextWithoutQuote } from '../protocol/quote-protocol.ts'
import { ensureToolbarStyles, styles } from '../styles.ts'
import { TranscriptQuoteCard } from './TranscriptQuoteCard.tsx'

export interface UserMessageDisplayProps {
  node: {
    data: {
      content?: unknown
      seq?: number
      time?: number
    }
  }
  renderMessageImages?: (args: {
    images: unknown[]
    align: 'end'
    compact: boolean
  }) => ReactNode
  t?: (key: string, params?: Record<string, unknown>) => string
}

function contentImages(content: unknown): unknown[] {
  if (!Array.isArray(content)) return []
  const images: unknown[] = []
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const candidate = block as { type?: unknown; attachment?: unknown }
    if (candidate.type !== 'image' || candidate.attachment === undefined) continue
    images.push({ attachment: candidate.attachment })
  }
  return images
}

/**
 * Replacement for the built-in `user` Chat node view.
 *
 * Strips the `<response-annotations>` protocol block from the bubble **and**
 * renders one card per annotation right under it.
 *
 * Why the cards live here instead of on a `select-quote` Chat node:
 * `conversation.chat.node` is gated by the shipped `TURN_PROCESS_INDEPENDENT_KINDS`
 * allowlist (system-prompt, user, steering, turn-trigger, turn-process,
 * turn-error, turn-max-tokens, turn-tail). A node whose kind is not on that list
 * is classified as a turn-process member and `hidden` inside the collapsed
 * process disclosure of a completed turn — mounted, then invisible. `user` is on
 * the list, so rendering the cards inside this component is the only placement
 * that survives turn folding.
 */
export function UserMessageDisplay({
  node,
  renderMessageImages,
}: UserMessageDisplayProps): ReactNode {
  ensureToolbarStyles()
  const raw = contentBlocksToText(node.data?.content)
  // Prefer the structured protocol; fall back to legacy `>` quote strip.
  const scanned = scanAnnotatedMessage(raw)
  const text =
    scanned.annotations.length > 0
      ? scanned.rest
      : displayTextWithoutQuote(raw).trim()
  const quotes = scanned.annotations.length > 0 ? parseAnnotatedMessage(raw) : []
  const images = contentImages(node.data?.content)
  if (!text && images.length === 0 && quotes.length === 0) return null

  return jsx('div', {
    className: styles.userRow,
    children: jsxs('div', {
      className: styles.userStack,
      children: [
        images.length > 0 && renderMessageImages !== undefined
          ? jsx(
              'div',
              {
                className: styles.userImages,
                'data-message-attachments': true,
                children: renderMessageImages({
                  images,
                  align: 'end',
                  compact: images.length > 1,
                }),
              },
              'images',
            )
          : null,
        text
          ? jsx(
              'div',
              {
                className: styles.userBubble,
                children: text,
              },
              'bubble',
            )
          : null,
        quotes.length > 0
          ? jsx(
              TranscriptQuoteCard,
              { node: { data: { quotes, seq: node.data?.seq ?? 0 } } },
              'quotes',
            )
          : null,
      ],
    }),
  })
}

export function SteeringMessageDisplay(props: UserMessageDisplayProps): ReactNode {
  return UserMessageDisplay(props)
}
