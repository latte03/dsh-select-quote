/** Parse plugin-injected quote blocks out of a durable user/message text. */

export const QUOTE_MARKER = '> [选中文本]'

/** The composer's invisible send marker is never part of message text. */
const DRAFT_MARKER_RE = /\u200B/g

export interface ParsedQuote {
  /** Short preview title for the transcript card. */
  readonly title: string
  /** Full selected text (without `>` / marker). */
  readonly body: string
}

/** Plain text from Chat user-node content blocks (string or block array). */
export function contentBlocksToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (block && typeof block === 'object' && 'text' in block) {
        const text = (block as { text?: unknown }).text
        return typeof text === 'string' ? text : ''
      }
      return ''
    })
    .join('')
}

/**
 * Best-effort plain text from a durable `user/message` event. A surface event
 * carries its blocks directly on `data.content`; `data.message.content` is only
 * a fallback for the older shape.
 */
export function extractUserText(event: unknown): string {
  const data = (event as { data?: { content?: unknown; message?: { content?: unknown } } } | null)?.data
  if (!data) return ''
  return contentBlocksToText(data.content ?? data.message?.content)
}

function toQuote(body: string[]): ParsedQuote | null {
  const text = body.join('\n').trim()
  if (!text) return null
  const oneLine = text.replace(/\s+/g, ' ')
  return {
    title: oneLine.length > 48 ? `${oneLine.slice(0, 48)}…` : oneLine,
    body: text,
  }
}

/**
 * Detect every `> [选中文本]` + following `>` block written by the composer.
 * One message may carry several quotes; an empty array means none.
 */
export function parseQuoteMessage(text: string): ParsedQuote[] {
  if (!text.includes(QUOTE_MARKER)) return []

  const quotes: ParsedQuote[] = []
  let body: string[] | null = null

  for (const line of text.split('\n')) {
    const trimmed = line.trimEnd()
    if (body === null) {
      if (trimmed === QUOTE_MARKER || trimmed.startsWith(QUOTE_MARKER)) body = []
      continue
    }
    if (trimmed.startsWith('>')) {
      body.push(trimmed.replace(/^>\s?/, ''))
      continue
    }
    const quote = toQuote(body)
    if (quote) quotes.push(quote)
    body = null
    // The blank line between two quotes is followed by the next marker.
    if (trimmed === QUOTE_MARKER || trimmed.startsWith(QUOTE_MARKER)) body = []
  }

  if (body !== null) {
    const quote = toQuote(body)
    if (quote) quotes.push(quote)
  }
  return quotes
}

/**
 * Display text for a user bubble: drop every plugin quote block so the
 * transcript shows only the question. The durable message (and model payload)
 * still contains the full `> [选中文本]` text.
 */
export function displayTextWithoutQuote(text: string): string {
  // The composer's invisible send marker is never message text.
  const clean = text.replace(DRAFT_MARKER_RE, '')
  if (!clean.includes(QUOTE_MARKER)) return clean

  const out: string[] = []
  let skipping = false

  for (const line of clean.split('\n')) {
    const trimmed = line.trimEnd()
    if (!skipping) {
      if (trimmed === QUOTE_MARKER || trimmed.startsWith(QUOTE_MARKER)) {
        skipping = true
        continue
      }
      out.push(line)
      continue
    }
    if (trimmed.startsWith('>')) continue
    // First non-quote line ends the skip; keep it and the rest.
    skipping = false
    out.push(line)
  }

  return out.join('\n').replace(/^\n+/, '').trim()
}
