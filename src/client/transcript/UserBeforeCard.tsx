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
 * The seat hands the entry `{source, kind}` only: no message body. Two ways back
 * to the body, in this order:
 *
 *  1. `source.rpcId` — a user submission or a `subagents.prompt` delivery both
 *     carry one, and the durable node keeps it in `data.source`.
 *  2. the row's own `data-chat-flow-key` — the activation prompt of a side
 *     question is submitted as `source: { kind: 'user' }`, with **no rpcId**.
 *
 * A subagent session is a fork of its parent: every copied message keeps the
 * parent's rpcId, so those rows would re-render the parent's cards inside the
 * child. Inherited rows are hidden there; only the child's own question (the
 * rpcId-less activation) decorates.
 */

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { scanAnnotatedMessage } from '../protocol/annotation-protocol.ts'
import { runtime } from '../runtime.ts'
import {
  chatNodeTextOf,
  chatTurnOpenOf,
  sessionRunningOf,
  userMessageTextOf,
  type ChatStateLike,
  type SessionStatusLike,
  type UserBeforeOwner,
} from './chat-seat.ts'
import { TranscriptQuoteCard } from './TranscriptQuoteCard.tsx'

/** Props a `conversation.chat.user.before` entry receives. */
export interface UserBeforeCardProps {
  /** Election result from this entry's `select`; carries the durable source. */
  readonly matched?: UserBeforeOwner | null
  /** Standard session seat: selector hook over the Chat snapshot. */
  readonly useChat?: <T>(selector: (state: ChatStateLike) => T) => T
  /** Root seat: per-session run state ("is this session answering right now"). */
  readonly useSessionStatus?: <T>(
    selector: (snapshot: Map<string, SessionStatusLike>) => T,
  ) => T
  /** Standard session seat: the session this row belongs to. */
  readonly sessionId?: string
  [key: string]: unknown
}

/**
 * Annotation summary for the user row this seat decorates.
 *
 * Renders nothing when the message carries no annotation block, so rows without
 * annotations are untouched — the Host keeps ownership of the bubble, its
 * attachments and its time/copy actions row.
 */
export function UserBeforeCard({
  matched,
  useChat,
  useSessionStatus,
  sessionId,
}: UserBeforeCardProps): ReactNode {
  const rpcId = typeof matched?.source?.rpcId === 'string' ? matched.source.rpcId : undefined
  const hostRef = useRef<HTMLSpanElement | null>(null)
  const [flowKey, setFlowKey] = useState<string | null>(null)

  // The seat is a chain entry rendered inside the row, so the enclosing flow
  // key is only readable after mount. `display: contents` keeps this span out
  // of the layout.
  useLayoutEffect(() => {
    if (rpcId !== undefined) return
    const key = hostRef.current?.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key')
    setFlowKey(key ?? null)
  }, [rpcId])

  const select = <T,>(read: (state: ChatStateLike) => T): T | undefined =>
    typeof useChat === 'function' ? useChat(read) : undefined

  // Run state, straight from the Host's own seats: the turn flag first (it is
  // per-turn, so parallel steering rows cannot borrow each other's run), then
  // the session-level flag for rows the turn lookup cannot place. Both calls sit
  // here rather than in a helper so the hook order matches `select`'s.
  const turnOpen =
    typeof useChat === 'function' ? useChat((state) => chatTurnOpenOf(state, rpcId)) : undefined
  const sessionRunning =
    typeof useSessionStatus === 'function'
      ? useSessionStatus((snapshot) => sessionRunningOf(snapshot, sessionId))
      : undefined
  const running = turnOpen ?? sessionRunning ?? false

  const rpcText = select((state) => userMessageTextOf(state, rpcId))
  const keyedText = select((state) => chatNodeTextOf(state, flowKey))
  const text = rpcText ?? keyedText

  const quotes = useMemo(() => {
    if (typeof text !== 'string' || !text.includes('<response-annotations>')) return null
    const scanned = scanAnnotatedMessage(text)
    return scanned.annotations.length > 0 ? scanned.annotations : null
  }, [text])

  // A forked child copies the parent's transcript verbatim. Those rows still
  // carry the parent's rpcId, so their cards would show up a second time inside
  // the child — the parent's annotations leaking into a conversation that never
  // wrote them. Keep the decoration to the child's own question.
  const isSubagent = sessionId !== undefined && runtime.isSubagentSession?.(sessionId) === true
  const inherited = isSubagent && rpcId !== undefined

  return (
    <span ref={hostRef} style={{ display: 'contents' }} data-dsq-user-before="">
      {quotes !== null && !inherited ? (
        // In a side session the quote was taken by the sidebar agent, so its
        // mark wears a bot glyph instead of an ordinal.
        <TranscriptQuoteCard node={{ data: { quotes } }} robot={isSubagent} running={running} />
      ) : null}
    </span>
  )
}
