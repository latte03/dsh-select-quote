import { useMemo, type ComponentType, type ReactNode } from 'react'
import { scanAnnotatedMessage } from '../protocol/annotation-protocol.ts'
import { contentBlocksToText, displayTextWithoutQuote } from '../protocol/quote-protocol.ts'
import { ensureToolbarStyles, A, cx, styles } from '../styles.ts'
import { TranscriptQuoteCard } from './TranscriptQuoteCard.tsx'

/** The host's own Chat node view, rendered with a rewritten `node` prop. */
export type HostUserComponent = ComponentType<Record<string, unknown>>

export interface UserMessageDisplayProps {
  node: {
    data: {
      content?: unknown
      time?: number
      referenceLabels?: unknown
      skillNames?: unknown
    }
  }
  /** Resolves the host `UserMessageNodeView` from the live slot registry. */
  hostUserOf?: () => HostUserComponent | undefined
  /** Authorized image loader, used only by the hostless fallback bubble. */
  loadImage?: (attachment: unknown) => string | undefined
  [key: string]: unknown
}

function isTextBlock(block: unknown): boolean {
  if (block === null || typeof block !== 'object') return false
  const candidate = block as { type?: unknown; attachment?: unknown; text?: unknown }
  // Attachments are never text even if they carry a `text` field.
  if ((candidate.type === 'image' || candidate.type === 'file') && candidate.attachment !== undefined) {
    return false
  }
  // `contentBlocksToText` joins every block carrying a string `text`, so every
  // such block must be removed here or the text would be rendered twice.
  return candidate.type === 'text' || typeof candidate.text === 'string'
}

/**
 * Replace all text blocks with one stripped text block, keeping attachments and
 * unknown blocks in place. The host's `contentParts` joins text blocks and
 * lifts attachments out anyway, so one text block is the same message content
 * with the protocol block gone.
 */
function strippedContent(raw: unknown, text: string): unknown[] {
  const rest = Array.isArray(raw) ? raw.filter((block) => !isTextBlock(block)) : []
  if (text) rest.unshift({ type: 'text', text })
  return rest
}

/** Image attachments for the factory-less fallback bubble. */
function imageAttachments(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return []
  const images: unknown[] = []
  for (const block of raw) {
    if (block === null || typeof block !== 'object') continue
    const candidate = block as { type?: unknown; attachment?: unknown }
    if (candidate.type === 'image' && candidate.attachment !== undefined) {
      images.push(candidate.attachment)
    }
  }
  return images
}

/**
 * Replacement for the built-in `user` Chat node view.
 *
 * It does **not** redraw the bubble or its actions row. It resolves the host's
 * own `UserMessageNodeView` from `ctx.slots.entries('conversation.chat.node')`
 * and renders that component with a rewritten `node`: the annotation protocol
 * block is removed from the text blocks, everything else (attachments, file
 * cards, reference labels, time, copy, and any plugin that portals into the
 * actions row, e.g. dsh-rewind's ↶) stays host-owned and follows host changes.
 * The annotation cards are the only extra DOM, prepended above the host row.
 *
 * Cards must live inside the `user` node view rather than on a
 * `select-quote` Chat node: `conversation.chat.node` is gated by the shipped
 * `TURN_PROCESS_INDEPENDENT_KINDS` allowlist (system-prompt, user, steering,
 * turn-trigger, turn-process, turn-error, turn-max-tokens, turn-tail), and any
 * other kind is `hidden` when the completed turn's process disclosure folds.
 */
export function UserMessageDisplay(props: UserMessageDisplayProps): ReactNode {
  ensureToolbarStyles()
  const { node, hostUserOf, ...rest } = props
  const raw = contentBlocksToText(node.data?.content)
  const scanned = scanAnnotatedMessage(raw)
  const text =
    scanned.annotations.length > 0
      ? scanned.rest
      : displayTextWithoutQuote(raw).trim()
  const quotes = scanned.annotations
  // Only rewrite when the display text really differs from the original;
  // untouched messages go to the host exactly as the store published them.
  const rewritten = quotes.length > 0 || text !== raw.trim()
  const displayNode = useMemo(
    () =>
      rewritten
        ? {
            ...node,
            data: {
              ...node.data,
              content: strippedContent(node.data?.content, text),
            },
          }
        : node,
    [node, rewritten, text],
  )
  const cards =
    quotes.length > 0 ? <TranscriptQuoteCard node={{ data: { quotes } }} /> : null
  const Host = hostUserOf?.()

  if (Host !== undefined) {
    return (
      <>
        {cards}
        <Host {...rest} node={displayNode} />
      </>
    )
  }

  // Host-view resolution failed (host renamed its internal component). Show
  // the text rather than the protocol block; the actions row is host-owned, so
  // there is deliberately no private copy of it here.
  const images = imageAttachments(node.data?.content)
  const loadImage = props.loadImage
  return (
    <>
      {cards}
      <div className={cx(A.colEnd, styles.userRow)}>
        <div className={cx(A.colEnd, styles.userStack)} data-dsq-fallback-content="true">
          {images.length > 0 && loadImage !== undefined ? (
            <div className={cx(A.colEnd, styles.userImages)} data-message-attachments>
              {images.map((attachment, index) => {
                const url = loadImage(attachment)
                return url === undefined ? null : (
                  <img key={`image-${index}`} src={url} alt="" />
                )
              })}
            </div>
          ) : null}
          {text ? <div className={styles.userBubble}>{text}</div> : null}
        </div>
      </div>
    </>
  )
}

export function SteeringMessageDisplay(props: UserMessageDisplayProps): ReactNode {
  return UserMessageDisplay(props)
}
