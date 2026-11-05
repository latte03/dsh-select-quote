/**
 * dsh 0.2.2 user-text rule: hide the annotation protocol block.
 *
 * The host splits a durable user message into inline nodes through
 * `uiConversation.userText` rules. Text that no rule claims is rendered as the
 * literal substring, so a message carrying this plugin's
 * `<response-annotations>` block would paint the whole JSON — header prose
 * included — into the bubble.
 *
 * The rule claims exactly the protocol span (header prose and the
 * `<response-annotations>…</response-annotations>` payload) and renders it as
 * nothing. Annotation cards themselves are not built here: this rule only
 * removes text. The cards come from the `conversation.chat.user.before` chain,
 * which the host still renders above the bubble.
 *
 * Contract (see `UserTextDocument` in `@deepseek-ai/dsh-client-ui-conversation`):
 * `match(text, from, context)` must return a node whose `start >= from`, whose
 * `end > start`, whose `end <= text.length`, and whose `id` is either this
 * rule's id or the reserved `text` id. Returning `undefined` means "nothing
 * here". Evaluators run the head of every rule at each cursor, so the rule must
 * be cheap and must report the earliest claimed position, not the first
 * occurrence in the document.
 */

/** Rule id registered with `uiConversation.userText`. */
export const PROTOCOL_RULE_ID = 'select-quote.annotations'

/**
 * Runs after the host's own rules (`session` = 10, whitespace = 1000/1010) so
 * a `@session` reference inside the block cannot claim a prefix of it and leave
 * a half-block behind. Lower order wins ties at the same start.
 */
export const PROTOCOL_RULE_ORDER = 10_100

const BLOCK_OPEN = '<response-annotations>'
const BLOCK_CLOSE = '</response-annotations>'
const HEADER_MARKER = '# Response annotations:'

/**
 * True when `between` is the instruction body that sits between the header
 * title and the open marker: prose lines followed by one blank line, with no
 * second paragraph break. An unrelated quotation of the title leaves a whole
 * paragraph of other text there instead, and is rejected.
 */
function isProtocolHeader(between: string): boolean {
  const trimmed = between.replace(/\n+$/u, '')
  if (trimmed === '') return false
  return !trimmed.includes('\n\n')
}

/** One claimed span: the protocol region with no annotation text kept. */
export interface ProtocolSpan {
  readonly start: number
  readonly end: number
}

/**
 * The protocol span that begins at or after `from`, or undefined.
 *
 * The close marker may itself appear inside a JSON string of an older message
 * (written before `<` was escaped), so the scan accepts the first close marker
 * that leaves a JSON payload the composer's own reader would accept. A block
 * whose payload is unreadable is still hidden as long as both markers are
 * present — protocol text must never reach the transcript, valid or not.
 */
export function nextProtocolSpan(text: string, from: number): ProtocolSpan | undefined {
  const open = text.indexOf(BLOCK_OPEN, from)
  if (open < 0) return undefined
  const payloadStart = open + BLOCK_OPEN.length
  let close = text.indexOf(BLOCK_CLOSE, payloadStart)
  let end = -1
  while (close >= 0) {
    const payload = text.slice(payloadStart, close).trim().replace(/\\u003c/gu, '<')
    try {
      JSON.parse(payload)
      end = close + BLOCK_CLOSE.length
      break
    } catch {
      close = text.indexOf(BLOCK_CLOSE, close + BLOCK_CLOSE.length)
    }
  }
  if (end < 0) {
    // Unreadable payload: still hide the markers so no raw protocol shows.
    const firstClose = text.indexOf(BLOCK_CLOSE, payloadStart)
    if (firstClose < 0) return undefined
    end = firstClose + BLOCK_CLOSE.length
  }
  // The instructional header is part of the same wire block and reads as
  // noise on its own, so the claimed span starts at its title. It is adopted
  // only when it is the header of this very block: the open marker must be its
  // next paragraph. A message that merely quotes the title earlier therefore
  // keeps its own text.
  const header = text.lastIndexOf(HEADER_MARKER, open)
  let start = open
  if (header >= from && isProtocolHeader(text.slice(header + HEADER_MARKER.length, open))) {
    start = header
  }
  // The blank line that followed the block belongs to the fold: leaving it
  // shows an empty first line in the bubble.
  let trimmed = end
  while (trimmed < text.length && (text[trimmed] === '\n' || text[trimmed] === '\r')) {
    trimmed += 1
  }
  return { start, end: trimmed }
}

/** The user-text rule object handed to `uiConversation.userText.register`. */
export interface UserTextRule {
  readonly id: string
  readonly order: number
  match(
    text: string,
    from: number,
    context: { read(key: string): unknown },
  ): { id: string; start: number; end: number; data: { text: string; display: string } } | undefined
}

/**
 * Build the rule. `data.text` must equal the claimed substring byte for byte —
 * the host validates `text` nodes against `text.slice(start, end)`; `display`
 * is what actually renders, and an empty display hides the block.
 */
export function createProtocolRule(): UserTextRule {
  return {
    id: PROTOCOL_RULE_ID,
    order: PROTOCOL_RULE_ORDER,
    match(text, from) {
      const span = nextProtocolSpan(text, from)
      if (span === undefined) return undefined
      return {
        id: 'text',
        start: span.start,
        end: span.end,
        data: { text: text.slice(span.start, span.end), display: '' },
      }
    },
  }
}
