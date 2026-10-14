/**
 * Turn model-written `:dsh-annotation{index="N"}` into clickable chips.
 * Display-only decoration — durable message text is never rewritten.
 */

import { ANNOTATION_DIRECTIVE_RE } from '../protocol/annotation-protocol.ts'
import { findAnnotationMarkBefore, flashAnnotationMark } from './annotate-text.ts'
import { t } from '../i18n.ts'

const DECO = 'dsq-ann-directive'

function decorateTextNode(node: Text): void {
  const value = node.nodeValue
  if (!value || !value.includes(':dsh-annotation{')) return
  const parent = node.parentElement
  if (!parent || parent.closest(`[data-${DECO}]`)) return
  // Skip code/pre so directives in examples stay literal. Never touch the
  // composer either: at send time the draft briefly holds the raw protocol
  // block, whose own header quotes `:dsh-annotation{index="N"}`.
  if (parent.closest('pre, code, [data-dsq-toolbar]')) return
  if (parent.closest('textarea, input, [data-lexical-editor="true"]')) return

  const frag = document.createDocumentFragment()
  let last = 0
  let matched = false
  const re = new RegExp(ANNOTATION_DIRECTIVE_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    matched = true
    if (m.index > last) frag.append(document.createTextNode(value.slice(last, m.index)))
    const index = Number(m[1])
    const chip = document.createElement('button')
    chip.type = 'button'
    chip.className = 'dsq_annDirective'
    chip.dataset[DECO] = String(index)
    chip.setAttribute('data-dsq-deco', 'true')
    chip.textContent = t('chip.annotation', { index })
    chip.addEventListener('click', () => {
      // The annotation lives in the user turn that precedes this reply.
      const mark = findAnnotationMarkBefore(index, chip)
      if (mark) flashAnnotationMark(mark)
    })
    frag.append(chip)
    last = m.index + m[0].length
  }
  // The strict pattern deliberately rejects the marker's own documented shape
  // `:dsh-annotation{index="N"}`, which the protocol header quotes verbatim.
  // Without this guard the fall-through still calls replaceChild() with an
  // identical text node; the observer sees its own childList mutation and
  // re-enters. MutationObserver callbacks are microtasks, so the queue never
  // drains and no task — not even a DevTools evaluation — ever runs again.
  if (!matched) return
  if (last < value.length) frag.append(document.createTextNode(value.slice(last)))
  parent.replaceChild(frag, node)
}

/** Decorate all matching text nodes under root. Safe to call repeatedly. */
export function decorateAnnotationDirectives(root?: ParentNode): void {
  const el = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!el) return
  root = el

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const hits: Text[] = []
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (node instanceof Text && node.nodeValue?.includes(':dsh-annotation{')) hits.push(node)
  }
  for (const node of hits) decorateTextNode(node)
}

/** Observe chat DOM and decorate new directive text. Returns disposer. */
export function watchAnnotationDirectives(root?: ParentNode): () => void {
  const el = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!el || typeof MutationObserver === 'undefined') return () => {}
  decorateAnnotationDirectives(el)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Text) decorateTextNode(node)
        else if (node instanceof Element) decorateAnnotationDirectives(node)
      }
    }
  })
  observer.observe(el, { childList: true, subtree: true, characterData: true })
  return () => observer.disconnect()
}
