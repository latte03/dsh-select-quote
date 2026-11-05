/**
 * Annotation card above a user message, mounted on the Host's own decoration
 * seat (`conversation.chat.user.before`).
 *
 * dsh 0.2.2 makes this seat the official place for message-source decoration,
 * and it is the reason this plugin mounts its card here instead of overriding
 * the `user` Chat node. That override used to shadow the Host's own
 * `UserMessageNodeView`, and once shadowed the Host entry disappeared from the
 * registry — so the wrapper could never find it to delegate to, fell back to a
 * private bubble, and the message lost its time/copy row.
 *
 * The seat hands the entry `{source, kind}` only: no message body. The body is
 * recovered through the `useChat` standard prop, matching the durable node whose
 * `data.source.rpcId` equals the seat's `source.rpcId` (verified against the
 * running 0.2.2 client). The selector returns a **string**, never a fresh
 * object, so it stays a stable snapshot for React's external store.
 */

import { useMemo, type ReactNode } from 'react'
import { scanAnnotatedMessage } from '../protocol/annotation-protocol.ts'
import { userMessageTextOf, type ChatStateLike, type UserBeforeOwner } from './chat-seat.ts'
import { TranscriptQuoteCard } from './TranscriptQuoteCard.tsx'

/** Props a `conversation.chat.user.before` entry receives. */
export interface UserBeforeCardProps {
  /** Election result from this entry's `select`; carries the durable source. */
  readonly matched?: UserBeforeOwner | null
  /** Standard session seat: selector hook over the Chat snapshot. */
  readonly useChat?: <T>(selector: (state: ChatStateLike) => T) => T
  [key: string]: unknown
}

/**
 * Annotation summary for the user row this seat decorates.
 *
 * Renders nothing when the message carries no annotation block, so rows without
 * annotations are untouched — the Host keeps ownership of the bubble, its
 * attachments and its time/copy actions row.
 */
export function UserBeforeCard({ matched, useChat }: UserBeforeCardProps): ReactNode {
  const rpcId =
    typeof matched?.source?.rpcId === 'string' ? matched.source.rpcId : undefined
  const text =
    typeof useChat === 'function'
      ? useChat((state) => userMessageTextOf(state, rpcId))
      : undefined
  const quotes = useMemo(() => {
    if (typeof text !== 'string' || !text.includes('<response-annotations>')) return null
    const scanned = scanAnnotatedMessage(text)
    return scanned.annotations.length > 0 ? scanned.annotations : null
  }, [text])

  if (quotes === null) return null
  return <TranscriptQuoteCard node={{ data: { quotes } }} />
}
