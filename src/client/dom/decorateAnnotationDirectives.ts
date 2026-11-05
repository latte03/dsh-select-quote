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

/** True when the text is exactly one directive and nothing else. */
export function isOnlyDirective(value: string): boolean {
  const probe = new RegExp(`^\\s*${ANNOTATION_DIRECTIVE_RE.source}\\s*$`, 'u')
  return probe.test(value)
}

/**
 * Whether a text node sitting inside `<code>` should be turned into a chip.
 *
 * The protocol header tells the model to emit the directive inside inline code,
 * so the common case is a `<code>` whose entire content is one directive. A
 * fenced block (inside `pre`) or a sentence that merely mentions the marker
 * keeps its literal text.
 */
export function shouldChipCode(
  value: string,
  codeText: string | null | undefined,
  inPre: boolean,
): boolean {
  if (inPre) return false
  if (codeText == null) return false
  if (codeText.trim() !== value.trim()) return false
  return isOnlyDirective(value)
}

/**
 * Replace a `<code>` that holds nothing but one directive with its chip.
 *
 * The code element itself is dropped: keeping it would leave the grey inline
 * background around a button. The chip carries the same affordance the prose
 * form gets, so the reply reads the same either way.
 */
function decorateCodeSpan(code: Element, raw: string): void {
  const match = new RegExp(`^\\s*${ANNOTATION_DIRECTIVE_RE.source}\\s*$`, 'u').exec(raw)
  if (match === null) return
  const index = Number(match[1])
  if (!Number.isFinite(index) || index <= 0) return
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.className = cx(styles.annDirective, A.inlineRow)
  chip.setAttribute('data-dsq-deco', 'true')
  chip.dataset[DECO_KEY] = String(index)
  chip.textContent = t('chip.annotation', { index })
  bindChipPreview(chip, index)
  code.replaceWith(chip)
}

function decorateTextNode(node: Text): void {
  const value = node.nodeValue
  if (!value || !value.includes(':dsh-annotation{')) return
  const parent = node.parentElement
  if (!parent || parent.closest(`[data-${DECO}]`)) return
  // The protocol header tells the model to emit the directive *inside inline
  // code* ("include its inline directive `:dsh-annotation{index="N"}`"), so a
  // literal match in markdown usually arrives wrapped as `<code>`. Skipping
  // `pre`/`code` wholesale — the original guard against decorating examples —
  // therefore skipped exactly the case the prompt asks for, and the raw
  // directive showed up as a grey code span instead of a chip.
  //
  // Only a `<code>` whose whole content is the directive qualifies: that is the
  // single-token form the model was told to produce. Fenced examples and files
  // that merely mention the marker keep their literal text.
  const code = parent.closest('code')
  if (code !== null && shouldChipCode(value, code.textContent, code.closest('pre') !== null)) {
    decorateCodeSpan(code, value)
    return
  }
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
