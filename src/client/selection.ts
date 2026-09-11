/** Selection snapshot used by the floating toolbar. */
export interface SelectionSnapshot {
  /** Trimmed selected text. */
  readonly text: string
  /** Toolbar anchor: center-x / top-y in viewport coordinates. */
  readonly left: number
  readonly top: number
}

const TOOLBAR_OFFSET = 12
const VIEWPORT_MARGIN = 12
const LINE_TOP_TOLERANCE = 3

/** Contenteditable roots that must never host the selection toolbar. */
function isInsideEditable(node: Node | null): boolean {
  let current: Node | null = node
  while (current) {
    if (current instanceof HTMLElement) {
      if (current.isContentEditable) return true
      if (current.getAttribute('role') === 'textbox') return true
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
 * Read the live selection when it is a non-empty, non-editable range.
 * Conversation-area coverage (3B): any selectable text outside the composer.
 */
export function readSelectionSnapshot(toolbarRoot?: HTMLElement | null): SelectionSnapshot | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null

  const { anchorNode, focusNode } = selection
  if (!anchorNode || !focusNode) return null
  if (isInsideEditable(anchorNode) || isInsideEditable(focusNode)) return null
  if (toolbarRoot?.contains(anchorNode) || toolbarRoot?.contains(focusNode)) return null

  const text = selection.toString().replace(/\r\n/g, '\n').trim()
  if (!text) return null

  const rect = getRangeFirstLineRect(selection.getRangeAt(0))
  if (!rect) return null

  const { left, top } = toolbarPosition(rect)
  return { text, left, top }
}


/** Focus the resident composer editor and park the caret at the end. */
export function focusComposer(): void {
  const editor =
    document.querySelector<HTMLElement>('[data-lexical-editor="true"]') ??
    document.querySelector<HTMLElement>('[contenteditable="true"][data-lexical-editor]') ??
    lastEditable()
  if (!editor) return
  editor.focus({ preventScroll: false })
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  range.selectNodeContents(editor)
  range.collapse(false)
  selection.removeAllRanges()
  selection.addRange(range)
}

function lastEditable(): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>('[contenteditable="true"]')
  for (let i = nodes.length - 1; i >= 0; i -= 1) {
    const node = nodes[i]
    if (node instanceof HTMLElement && !node.closest('[data-dsq-toolbar]')) return node
  }
  return null
}

export function clearNativeSelection(): void {
  window.getSelection()?.removeAllRanges()
}

export async function copyText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  // Fallback for older webviews.
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
