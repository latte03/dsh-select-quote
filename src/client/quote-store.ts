/** Per-session quote card store. */

export interface StoredQuote {
  readonly id: string
  readonly text: string
  /** Truncated display title. */
  readonly title: string
  /** Exact block folded into the outgoing message at the send gesture. */
  readonly draftBlock: string
}

const EMPTY_QUOTES: readonly StoredQuote[] = []

const bySession = new Map<string, StoredQuote[]>()
const listeners = new Set<() => void>()

/** Notify every mounted card that the store changed. */
function notify(): void {
  for (const listener of [...listeners]) listener()
}

/** Observe store changes (save / remove / clear). Returns the unsubscribe callback. */
export function subscribeQuotes(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function preview(text: string, max = 48): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine
}

/**
 * Markdown blockquote of the selection — what the model should read.
 * `[选中文本]` marks the block as plugin-injected (not a hand-typed quote).
 */
export function formatQuoteBlock(text: string): string {
  const body = text
    .split('\n')
    .map((line) => (line.length > 0 ? `> ${line}` : '>'))
    .join('\n')
  return `> [选中文本]\n${body}`
}

/**
 * Invisible draft marker (U+200B) that keeps the composer's own send button
 * enabled while only quotes are pending: the composer then treats the draft as
 * non-empty, and the marker never reaches the message.
 */
export const DRAFT_MARKER = '\u200B'

/** Ensure the draft carries the invisible marker, without disturbing its text. */
export function withDraftMarker(draft: string): string {
  return draft.includes(DRAFT_MARKER) ? draft : `${draft}${DRAFT_MARKER}`
}

/** Remove every invisible marker from a draft. */
export function stripDraftMarker(draft: string): string {
  return draft.split(DRAFT_MARKER).join('')
}

/**
 * Fold every pending quote block into the draft. Called only at the send
 * gesture, so the composer never displays the markdown while the user types.
 */
export function composeSubmission(draft: string, quoteBlocks: readonly string[]): string {
  const rest = stripDraftMarker(draft).replace(/^\s+/, '')
  const prefix = quoteBlocks.filter((block) => block.length > 0).join('\n\n')
  if (prefix === '') return rest
  // Avoid duplicating blocks that already reached the draft.
  if (quoteBlocks.every((block) => rest.includes(block))) return rest
  return rest ? `${prefix}\n\n${rest}` : `${prefix}\n\n`
}

/** Append one selection as a quote card; an identical pending quote is reused. */
export function saveQuote(sessionId: string, text: string): StoredQuote {
  const draftBlock = formatQuoteBlock(text)
  const current = bySession.get(sessionId) ?? EMPTY_QUOTES
  const duplicate = current.find((quote) => quote.draftBlock === draftBlock)
  if (duplicate) return duplicate

  const quote: StoredQuote = {
    id: `sq_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    text,
    title: preview(text),
    draftBlock,
  }
  bySession.set(sessionId, [...current, quote])
  notify()
  return quote
}

export function getQuotes(sessionId: string): readonly StoredQuote[] {
  return bySession.get(sessionId) ?? EMPTY_QUOTES
}

export function removeQuote(sessionId: string, id: string): void {
  const current = bySession.get(sessionId)
  if (!current) return
  const next = current.filter((quote) => quote.id !== id)
  if (next.length === current.length) return
  if (next.length === 0) bySession.delete(sessionId)
  else bySession.set(sessionId, next)
  notify()
}

export function clearQuotes(sessionId: string): void {
  if (bySession.delete(sessionId)) notify()
}
