/**
 * Turn model-written `:dsh-annotation{index="N"}` into clickable chips.
 * Display-only decoration — durable message text is never rewritten.
 */

import { ANNOTATION_DIRECTIVE_RE } from '../protocol/annotation-protocol.ts'
import { bindChipPreview, closeChipPreview } from './chipPreview.ts'
import { t } from '../i18n.ts'
import { A, cx, styles } from '../styles.ts'

const DECO = 'dsq-ann-directive'
// `dataset` keys must be valid JavaScript identifiers: the dashed attribute
// name above throws `SyntaxError: ... is not a valid property name` the moment
// it is assigned, so bracket access needs the camelCase spelling (which maps to
// the same `data-dsq-ann-directive` attribute).
const DECO_KEY = 'dsqAnnDirective'

function decorateTextNode(node: Text): void {
  const value = node.nodeValue
  if (!value || !value.includes(':dsh-annotation{')) return
  const parent = node.parentElement
  if (!parent || parent.closest(`[data-${DECO}]`)) return
  // Skip code/pre so directives in examples stay literal. Never touch the
  // composer either: at send time the draft briefly holds the raw protocol
  // block, whose own header quotes `:dsh-annotation{index="N"}`. The preview
  // shows user-authored quote/comment text and must stay literal too.
  if (parent.closest('pre, code, [data-dsq-toolbar], [data-dsq-chip-preview]')) return
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
    chip.className = cx(styles.annDirective, A.inlineRow)
    chip.setAttribute('data-dsq-deco', 'true')
    chip.dataset[DECO_KEY] = String(index)
    chip.textContent = t('chip.annotation', { index })
    bindChipPreview(chip, index)
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

/**
 * Re-label chips that are already on screen after the language changed.
 *
 * Chip text is plain DOM, not React state, so a switch would otherwise leave
 * old-language chips next to new-language popovers. Writing `textContent` here
 * is safe for the observer: the new text node never contains the directive
 * literal, so `decorateTextNode()` returns before it can touch the DOM.
 */
export function refreshDirectiveChips(root?: ParentNode): void {
  closeChipPreview(false)
  const el = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!el) return
  for (const chip of el.querySelectorAll<HTMLElement>(`[data-${DECO}]`)) {
    const index = Number(chip.dataset[DECO_KEY])
    if (Number.isFinite(index)) chip.textContent = t('chip.annotation', { index })
  }
}

/** Observe chat DOM and decorate new directive text. Returns disposer. */
export function watchAnnotationDirectives(root?: ParentNode): () => void {
  const el = root ?? (typeof document === 'undefined' ? undefined : document.body)
  if (!el || typeof MutationObserver === 'undefined') return () => {}
  decorateAnnotationDirectives(el)
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      // Streaming lands as an in-place text mutation, and such records carry no
      // added nodes — walking only addedNodes leaves the raw directive on
      // screen until something re-creates the message DOM (a session switch,
      // say), which is exactly the "it works after I switch sessions" report.
      if (record.type === 'characterData') {
        if (record.target instanceof Text) decorateTextNode(record.target)
        continue
      }
      for (const node of record.addedNodes) {
        if (node instanceof Text) decorateTextNode(node)
        else if (node instanceof Element) decorateAnnotationDirectives(node)
      }
    }
  })
  observer.observe(el, { childList: true, subtree: true, characterData: true })
  return () => observer.disconnect()
}
