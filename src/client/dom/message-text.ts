/**
 * Message-text geometry: locate a selection inside the transcript and express
 * it as stable character offsets over the message's own text.
 *
 * Offsets are computed over "clean text": the flow item's text nodes with the
 * plugin's own chrome (summary blocks, directive chips, anchors) skipped. Marks
 * are transparent — their text still counts — so an offset captured before a
 * mark exists stays valid after decoration.
 */

/** Flow items carry the message identity in `data-chat-flow-key`. */
const FLOW_ITEM = '[data-chat-flow-key]'
/** Plugin chrome whose text must not count toward message text offsets. */
const DECO_SKIP = '[data-dsq-deco]'

export type MessageKind = 'user' | 'assistant' | 'tool'

export interface MessageLocator {
  /** `data-chat-flow-key` of the message that owns the text. */
  readonly messageId: string
  readonly messageKind: MessageKind
  readonly startOffset: number
  readonly endOffset: number
}

interface TextEntry {
  readonly node: Text
  readonly start: number
  readonly end: number
}

export function messageKindOfFlowKey(key: string): MessageKind {
  if (key.includes('input-message')) return 'user'
  if (key.includes('tool-call')) return 'tool'
  return 'assistant'
}

/** Text nodes of `root` with plugin chrome skipped, as a flat offset map. */
export function collectCleanText(root: HTMLElement): TextEntry[] {
  const entries: TextEntry[] = []
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let offset = 0
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (!(node instanceof Text)) continue
    const value = node.nodeValue ?? ''
    if (value.length === 0) continue
    if (node.parentElement?.closest(DECO_SKIP)) continue
    entries.push({ node, start: offset, end: offset + value.length })
    offset += value.length
  }
  return entries
}

export function flowItemOf(node: Node | null): HTMLElement | null {
  const el = node instanceof Element ? node : node?.parentElement
  const item = el?.closest(FLOW_ITEM)
  return item instanceof HTMLElement ? item : null
}

/**
 * True when the node lives inside a conversation message. Selections in the
 * sidebar, settings, model picker or any other app chrome are not quotes, so
 * the toolbar must stay away from them.
 */
export function isInsideTranscript(node: Node | null): boolean {
  return flowItemOf(node) !== null
}

function pointOffset(entries: readonly TextEntry[], container: Node, offset: number): number | null {
  for (const entry of entries) {
    if (entry.node === container) return entry.start + Math.min(offset, entry.end - entry.start)
  }
  // Element container (selection anchored at a node boundary): resolve to the
  // text position just inside that boundary.
  if (!(container instanceof Element)) return null
  const inside = entries.filter((entry) => container.contains(entry.node))
  if (inside.length === 0) return null
  const children = container.childNodes
  if (offset <= 0) return inside[0].start
  if (offset >= children.length) return inside[inside.length - 1].end
  const before = children[offset - 1]
  const after = children[offset]
  const inBefore = inside.filter((entry) => before.contains(entry.node))
  if (inBefore.length > 0) return inBefore[inBefore.length - 1].end
  const inAfter = inside.filter((entry) => after.contains(entry.node))
  if (inAfter.length > 0) return inAfter[0].start
  return null
}

/**
 * Character offsets of `range` inside its flow item, or null when the range
 * does not resolve against the item's clean text (cross-message selections,
 * element-boundary anchors).
 */
export function rangeOffsetsInFlowItem(range: Range): MessageLocator | null {
  const item = flowItemOf(range.startContainer)
  if (!item) return null
  const key = item.dataset.chatFlowKey
  if (!key) return null

  const entries = collectCleanText(item)
  if (entries.length === 0) return null
  const total = entries[entries.length - 1].end

  const start = pointOffset(entries, range.startContainer, range.startOffset)
  let end = pointOffset(entries, range.endContainer, range.endOffset)
  if (start === null) return null
  // Cross-message drag: clamp to the end of the anchor's message.
  if (end === null || end < start) end = total
  if (end <= start) return null

  return {
    messageId: key,
    messageKind: messageKindOfFlowKey(key),
    startOffset: start,
    endOffset: Math.min(end, total),
  }
}

/** Locate `[start, end)` of a flow item's clean text as a DOM range. */
export function cleanTextRange(
  item: HTMLElement,
  start: number,
  end: number,
): { entries: TextEntry[]; from: number; to: number } | null {
  const entries = collectCleanText(item)
  if (entries.length === 0) return null
  const total = entries[entries.length - 1].end
  const from = Math.max(0, Math.min(start, total))
  const to = Math.max(from, Math.min(end, total))
  if (to <= from) return null
  return { entries, from, to }
}

/** Entries overlapping `[from, to)`, trimmed to the overlap. */
export function overlappingEntries(
  entries: readonly TextEntry[],
  from: number,
  to: number,
): { entry: TextEntry; start: number; end: number }[] {
  const out: { entry: TextEntry; start: number; end: number }[] = []
  for (const entry of entries) {
    if (entry.end <= from) continue
    if (entry.start >= to) break
    out.push({ entry, start: Math.max(entry.start, from), end: Math.min(entry.end, to) })
  }
  return out
}

/** Raw clean text of a flow item (marks transparent, plugin chrome skipped). */
export function cleanTextOf(item: HTMLElement): string {
  return collectCleanText(item)
    .map((entry) => entry.node.nodeValue ?? '')
    .join('')
}
