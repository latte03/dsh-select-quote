/**
 * Shapes of the Chat snapshot a `conversation.chat.user.before` entry sees.
 *
 * Only the parts this plugin reads are modelled. The Host owns the real
 * definitions (`@deepseek-ai/dsh-client-ui-conversation`); restating them keeps
 * `tsc` working without importing a Harness Client package, which plugins are
 * forbidden to require.
 */

/** Durable message source the seat receives; Chat does not interpret it. */
export interface UserBeforeSource {
  readonly kind?: string
  /** Submission rpc id; matches the durable node's `data.source.rpcId`. */
  readonly rpcId?: string
  readonly clientTimeZone?: string
}

/** Owner props of the `conversation.chat.user.before` chain. */
export interface UserBeforeOwner {
  readonly source?: UserBeforeSource
  readonly kind?: 'user' | 'steering'
}

/** One durable Chat node, as far as this plugin inspects it. */
export interface ChatNodeLike {
  readonly kind?: string
  readonly data?: {
    readonly messageId?: string
    readonly source?: UserBeforeSource
    readonly content?: unknown
  }
}

/** The slice of the Chat snapshot that can resolve a message body. */
export interface ChatStateLike {
  readonly nodes?: {
    /** Keyed node map: `Map<flowKey, ChatNodeLike>`. */
    readonly byKey?: Map<string, ChatNodeLike>
  }
}

/** Plain text from Chat user-node content blocks (string or block array). */
function blocksToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  let out = ''
  for (const block of content) {
    if (block === null || typeof block !== 'object') continue
    const text = (block as { text?: unknown }).text
    if (typeof text === 'string') out += text
  }
  return out
}

/**
 * The message text behind one user row, or undefined while it is not loaded.
 *
 * Matching is on `rpcId`, not on `messageId`: the seat's source carries the
 * submission rpc id, and the durable node keeps that same id in its own
 * `data.source`, while `data.messageId` is a different value.
 *
 * Kept as plain data code (no React) so the verification harness can replay it
 * without a DOM.
 */
/**
 * The message text for one chat flow key.
 *
 * The activation prompt a side question sends carries `source: { kind: "user" }`
 * with **no rpcId** (the Host's `startLocal` submits it that way), so the rpcId
 * match cannot find it. The row's own `data-chat-flow-key` is the durable key
 * into `nodes.byKey`, which resolves it exactly instead of guessing.
 */
export function chatNodeTextOf(
  state: ChatStateLike | undefined,
  flowKey: string | null | undefined,
): string | undefined {
  if (flowKey === null || flowKey === undefined) return undefined
  const byKey = state?.nodes?.byKey
  if (!(byKey instanceof Map)) return undefined
  const node = byKey.get(flowKey)
  if (node?.kind !== 'user') return undefined
  return blocksToText(node.data?.content)
}

export function userMessageTextOf(
  state: ChatStateLike | undefined,
  rpcId: string | undefined,
): string | undefined {
  if (rpcId === undefined) return undefined
  const byKey = state?.nodes?.byKey
  if (!(byKey instanceof Map)) return undefined
  for (const value of byKey.values()) {
    const node = value
    if (node?.kind !== 'user') continue
    if (node.data?.source?.rpcId !== rpcId) continue
    return blocksToText(node.data?.content)
  }
  return undefined
}

