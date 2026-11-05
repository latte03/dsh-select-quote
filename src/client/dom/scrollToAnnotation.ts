/**
 * Scroll the conversation to one annotation: its inline mark in the message
 * body first, then a DOM node that still contains the selected text.
 */

import { findAnnotationMark, flashAnnotationMark } from './annotate-text.ts'

/** Scrolls to the mark (or its text) and reports whether anything was found. */
export function scrollToAnnotation(index: number, text: string, markId?: string): boolean {
  const mark = findAnnotationMark(index, text, markId)
  if (mark) {
    flashAnnotationMark(mark)
    return true
  }
  const byText = findElementByText(text)
  if (byText) {
    byText.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return true
  }
  return false
}

function findElementByText(text: string): HTMLElement | null {
  const needle = text.trim().slice(0, 32)
  if (needle.length < 2) return null
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  let best: HTMLElement | null = null
  let bestScore = 0
  while (walker.nextNode()) {
    const node = walker.currentNode
    const value = node.textContent ?? ''
    if (!value.includes(needle)) continue
    const el = node.parentElement
    if (!el || el.closest('[data-dsq-toolbar], [data-selection-annotation-summary]')) continue
    // Prefer the deepest reasonably sized block.
    const score = value.length < 500 ? 2 : 1
    if (score > bestScore) {
      best = el
      bestScore = score
      if (score === 2) break
    }
  }
  return best
}
