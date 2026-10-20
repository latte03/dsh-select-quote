/** Selection snapshot used by the floating toolbar. */
import { floatingLayerFor, type FloatingLayer } from './floating-layer.ts'
import { isInsideTranscript, rangeOffsetsInFlowItem, type MessageLocator } from './message-text.ts'

export interface SelectionSnapshot {
  /** Trimmed selected text. */
  readonly text: string
  /**
   * Toolbar anchor inside the transcript scroll layer: center-x / top-y in
   * content coordinates (they move with the scrolled content).
   */
  readonly left: number
  readonly top: number
  /** The toolbar hangs under the first line because there is no room above. */
  readonly below: boolean
  /** Bottom of the whole selection (content coords), for the comment popover. */
  readonly selectionBottom: number
  /** Scroll container the toolbar portals into (clips and stacks with it). */
  readonly layer: FloatingLayer
  /** Where the selection lives in the transcript, when it resolves. */
  readonly source?: MessageLocator
  /** href of the anchor the selection sits in, when it sits in one. */
  readonly anchorHref?: string
}

const TOOLBAR_OFFSET = 12
const BELOW_GAP = 8
/** Estimated toolbar height; only used to decide above vs below at content top. */
const TOOLBAR_HEIGHT = 40
const VIEWPORT_MARGIN = 12
const LINE_TOP_TOLERANCE = 3

/**
 * True only for the resident composer / inputs — never for transcript text.
 * (A broad `isContentEditable` / `role=textbox` walk rejects legitimate chat
 * selections when an ancestor is editable.)
 */
function isInsideComposerInput(node: Node | null): boolean {
  let current: Node | null = node
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.closest('[data-dsq-toolbar]')) return true
      if (current.matches('textarea, input, [data-lexical-editor="true"]')) return true
      if (current.closest('[data-composer-card]') && current.isContentEditable) return true
    }
    current = current.parentNode
  }
  return false
}

function mergeRects(rects: DOMRect[]): DOMRect {
  const left = Math.min(...rects.map((rect) => rect.left))
  const right = Math.max(...rects.map((rect) => rect.right))
  const top = Math.min(...rects.map((rect) => rect.top))
  const bottom = Math.max(...rects.map((rect) => rect.bottom))
  return DOMRect.fromRect({
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  })
}

function getRangeFirstLineRect(range: Range): DOMRect | undefined {
  const rects = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0)
  if (rects.length === 0) {
    const rect = range.getBoundingClientRect()
    return rect.width > 0 || rect.height > 0 ? rect : undefined
  }
  const firstTop = Math.min(...rects.map((rect) => rect.top))
  const firstLineRects = rects.filter((rect) => Math.abs(rect.top - firstTop) <= LINE_TOP_TOLERANCE)
  return mergeRects(firstLineRects)
}

/** Keep the centered toolbar inside the visible horizontal band. */
function anchorX(rect: DOMRect, bounds: DOMRect): number {
  const center = rect.left + rect.width / 2
  const min = bounds.left + VIEWPORT_MARGIN
  const max = Math.max(min, bounds.right - VIEWPORT_MARGIN)
  return Math.min(Math.max(center, min), max)
}

/**
 * True when the selection's first line still touches the viewport.
 *
 * The toolbar anchors to that line, so once it has scrolled fully out of
 * view there is nothing to anchor to and the snapshot reads as "gone" — the
 * toolbar hides and comes back when the user scrolls to the selection again
 * (scroll re-reads the selection). A partially visible line still counts:
 * `toolbarPosition` parks the toolbar at the viewport edge in that case.
 */
function isFirstLineOnScreen(rect: DOMRect): boolean {
  return (
    rect.bottom > 0 &&
    rect.top < window.innerHeight &&
    rect.right > 0 &&
    rect.left < window.innerWidth
  )
}

/**
 * Read the live selection when it is a non-empty range inside a conversation
 * message and outside the composer / our own chrome.
 */
export function readSelectionSnapshot(toolbarRoot?: HTMLElement | null): SelectionSnapshot | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null

  const { anchorNode, focusNode } = selection
  if (!anchorNode || !focusNode) return null
  if (isInsideComposerInput(anchorNode) || isInsideComposerInput(focusNode)) return null
  if (toolbarRoot?.contains(anchorNode) || toolbarRoot?.contains(focusNode)) return null
  // Only quotes taken from the transcript qualify: selecting the sidebar,
  // settings or any other app chrome must not raise the toolbar.
  if (!isInsideTranscript(anchorNode) || !isInsideTranscript(focusNode)) return null

  const text = selection.toString().replace(/\r\n/g, '\n').trim()
  if (!text) return null

  const rect = getRangeFirstLineRect(selection.getRangeAt(0))
  if (!rect) return null
  // Scrolled out of view: no anchor for the toolbar (see isFirstLineOnScreen).
  if (!isFirstLineOnScreen(rect)) return null

  const layer = floatingLayerFor(anchorNode)
  const bounds = layer.bounds()
  const x = anchorX(rect, bounds)
  // Content coordinates: the anchor moves with the scrolled text, and the
  // scroller clips it. No top clamp — a toolbar above the first line must slide
  // under the transcript's top edge (the header) like the content itself.
  const above = layer.toContent(x, rect.top - TOOLBAR_OFFSET)
  // At the very top of the transcript there is no room above the first line at
  // all; hanging it under the line is better than clipping it away entirely.
  const below = above.top < TOOLBAR_HEIGHT
  const anchor = below ? layer.toContent(x, rect.bottom + BELOW_GAP) : above
  // The comment popover starts under the whole selection, not under the
  // toolbar: the toolbar sits only 12px above the first line, so a popover
  // anchored to it would cover the selected words.
  const range = selection.getRangeAt(0)
  const union = range.getBoundingClientRect()
  const selectionBottom = layer.toContent(0, union.height > 0 ? union.bottom : rect.bottom).top
  const source = rangeOffsetsInFlowItem(range)
  // A selection over a link's wording is still "a link" as far as the user is
  // concerned, so carry the anchor's href for the open action.
  const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement
  const anchorHref = anchorElement?.closest('a[href]')?.getAttribute('href') ?? undefined
  return {
    text,
    left: anchor.left,
    top: anchor.top,
    below,
    selectionBottom,
    layer,
    ...(source ? { source } : {}),
    ...(anchorHref ? { anchorHref } : {}),
  }
}

export function clearNativeSelection(): void {
  window.getSelection()?.removeAllRanges()
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.left = '-9999px'
  document.body.appendChild(area)
  area.select()
  document.execCommand('copy')
  area.remove()
}
