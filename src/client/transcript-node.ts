import type { Context } from '@deepseek-ai/cordis'
import { extractUserText, parseQuoteMessage, type ParsedQuote } from './transcript-parse.ts'

/** View payload published to the `select-quote` Chat node. */
export interface SelectQuoteNodeData {
  /** Every quote carried by the one durable user message. */
  readonly quotes: readonly ParsedQuote[]
  readonly seq: number
}

const KIND = 'select-quote'

/**
 * Conversation Definition: one durable `user/message` that carries plugin quote
 * blocks becomes a `select-quote` Chat node (rendered as a card per quote).
 */
export function createSelectQuoteDefinition() {
  return {
    kind: KIND,
    target: 'chat',
    match(event: { type?: string; seq?: number }) {
      if (event.type !== 'user/message') return null
      if (parseQuoteMessage(extractUserText(event)).length === 0) return null
      return { id: `${KIND}-${event.seq ?? 0}`, role: 'start' as const }
    },
    start(_context: unknown, match: { event: { seq?: number } }) {
      const quotes = parseQuoteMessage(extractUserText(match.event))
      if (quotes.length === 0) throw new Error('select-quote: missing quote payload on start')
      return { quotes, seq: match.event.seq ?? 0 } satisfies SelectQuoteNodeData
    },
    update(context: { state: SelectQuoteNodeData }) {
      return context.state
    },
    buildViewNode(context: {
      key: string
      id: string
      state?: SelectQuoteNodeData
      start?: { event: { seq?: number }; location?: unknown }
      matches?: readonly { event: { seq?: number }; location?: unknown }[]
    }) {
      if (context.state === undefined) return null
      const anchor =
        context.start?.event.seq ?? context.matches?.[0]?.event.seq ?? context.state.seq ?? 0
      const location =
        context.start?.location ?? context.matches?.[0]?.location ?? { kind: 'unresolved' }
      return {
        key: context.key,
        kind: KIND,
        id: context.id,
        target: 'chat',
        anchorSeq: anchor,
        location,
        visibility: 'visible' as const,
        data: context.state,
      }
    },
  }
}

export function registerSelectQuoteNode(ctx: Context): void {
  const uiConversation = (ctx as Context & {
    uiConversation?: {
      events: { register(def: unknown): () => void }
    }
  }).uiConversation

  if (!uiConversation) {
    console.warn('[dsh-select-quote] uiConversation unavailable; transcript card disabled')
    return
  }

  ctx.effect(
    () => uiConversation.events.register(createSelectQuoteDefinition()),
    'dsh-select-quote: conversation node definition',
  )
}
