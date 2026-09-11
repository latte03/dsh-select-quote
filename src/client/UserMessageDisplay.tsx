import type { ReactNode } from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { ensureToolbarStyles, styles } from './styles.ts'
import { contentBlocksToText, displayTextWithoutQuote } from './transcript-parse.ts'

export interface UserMessageDisplayProps {
  node: {
    data: {
      content?: unknown
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

/**
 * Image blocks carried by one durable user message, in the shape the
 * attachment presentation slot renders (`{ attachment }`).
 */
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
 * Hides the plugin `> [选中文本]` block in the bubble (the transcript card
 * already shows it) while still rendering the message's durable images — a
 * quote-only message has no visible text at all, so the images are the only
 * thing left to show.
 */
export function UserMessageDisplay({ node, renderMessageImages }: UserMessageDisplayProps): ReactNode {
  ensureToolbarStyles()
  const text = displayTextWithoutQuote(contentBlocksToText(node.data?.content)).trim()
  const images = contentImages(node.data?.content)
  if (!text && images.length === 0) return null

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
                children: renderMessageImages({ images, align: 'end', compact: images.length > 1 }),
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
      ],
    }),
  })
}

/** Same treatment for admitted steering messages. */
export function SteeringMessageDisplay(props: UserMessageDisplayProps): ReactNode {
  return UserMessageDisplay(props)
}
