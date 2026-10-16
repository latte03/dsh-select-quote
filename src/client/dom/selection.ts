/** Selection snapshot used by the floating toolbar. */
import { isInsideTranscript, rangeOffsetsInFlowItem, type MessageLocator } from './message-text.ts'

export interface SelectionSnapshot {
  /** Trimmed selected text. */
  readonly text: string
  /** Toolbar anchor: center-x / top-y in viewport coordinates. */
  readonly left: number
  readonly top: number
  /** Where the selection lives in the transcript, when it resolves. */
  readonly source?: MessageLocator
  /** href of the anchor the selection sits in, when it sits in one. */
  readonly anchorHref?: string
}

const TOOLBAR_OFFSET = 12
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

function toolbarPosition(rect: DOMRect): { left: number; top: number } {
  const center = rect.left + rect.width / 2
  return {
    left: Math.min(Math.max(center, VIEWPORT_MARGIN), window.innerWidth - VIEWPORT_MARGIN),
    top: Math.max(rect.top - TOOLBAR_OFFSET, VIEWPORT_MARGIN),
  }
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

  const { left, top } = toolbarPosition(rect)
  const source = rangeOffsetsInFlowItem(selection.getRangeAt(0))
  // A selection over a link's wording is still "a link" as far as the user is
  // concerned, so carry the anchor's href for the open action.
  const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement
  const anchorHref = anchorElement?.closest('a[href]')?.getAttribute('href') ?? undefined
  return { text, left, top, ...(source ? { source } : {}), ...(anchorHref ? { anchorHref } : {}) }
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
