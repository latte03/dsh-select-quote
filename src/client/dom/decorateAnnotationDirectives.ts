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
 * The protocol header tells the model to emit the directive in plain prose, but
 * earlier runs wrapped it in inline code and models may still do so. A fenced
 * block (inside `pre`) or a sentence that merely mentions the marker keeps its
 * literal text.
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

export type DirectiveSegment = { kind: 'text'; text: string } | { kind: 'chip'; index: number }

export interface DirectiveSplit {
  /** Prose before the first directive — this stays in the host's own text node. */
  readonly prefix: string
  /** Mirrored siblings after it; always starts with a chip. */
  readonly segments: readonly DirectiveSegment[]
}

/**
 * Plan the mirror split of one text node's value, or null when it carries no
 * directive. Pure: the DOM layer only materialises what this returns.
 */
export function splitDirectives(value: string): DirectiveSplit | null {
  const re = new RegExp(ANNOTATION_DIRECTIVE_RE.source, 'g')
  const segments: DirectiveSegment[] = []
  let prefix = ''
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    const before = value.slice(last, m.index)
    if (segments.length === 0) prefix = before
    else if (before !== '') segments.push({ kind: 'text', text: before })
    segments.push({ kind: 'chip', index: Number(m[1]) })
    last = m.index + m[0].length
  }
  // The strict pattern deliberately rejects the marker's own documented shape
  // `:dsh-annotation{index="N"}`, which the protocol header quotes verbatim.
  if (segments.length === 0) return null
  if (last < value.length) segments.push({ kind: 'text', text: value.slice(last) })
  return { prefix, segments }
}

function makeChip(index: number): HTMLElement {
  const chip = document.createElement('button')
  chip.type = 'button'
  chip.className = cx(styles.annDirective, A.inlineRow)
  chip.setAttribute('data-dsq-deco', 'true')
  chip.dataset[DECO_KEY] = String(index)
  chip.textContent = t('chip.annotation', { index })
  bindChipPreview(chip, index)
  return chip
}

/**
 * Chip a `<code>` that holds nothing but one directive.
 *
 * The element stays in the document: React owns it through `setTextContent` and
 * calls `removeChild` on it when the message goes away, so taking it out
 * ourselves makes that throw NotFoundError. It is emptied — the grey inline
 * background must not wrap the chip — and hidden, with the chip beside it.
 */
function decorateCodeSpan(code: Element, raw: string): void {
  const match = new RegExp(`^\\s*${ANNOTATION_DIRECTIVE_RE.source}\\s*$`, 'u').exec(raw)
  if (match === null) return
  const index = Number(match[1])
  if (!Number.isFinite(index) || index <= 0) return
  const sibling = code.nextElementSibling
  const mine = codeChips.get(code)
    ?? (sibling instanceof HTMLElement && sibling.dataset[DECO_KEY] !== undefined ? sibling : null)
  if (mine !== null && mine.dataset[DECO_KEY] === String(index)) {
    codeChips.set(code, mine)
  } else {
    mine?.remove()
    const chip = makeChip(index)
    code.after(chip)
    codeChips.set(code, chip)
  }
  if (code.textContent !== '') code.textContent = ''
  code.classList.add(styles.annCodeHost)
}

/** Marks the span holding one host node's mirrors; survives a module reload. */
const MIRROR = 'data-dsq-ann-mirror'

interface Mirror {
  /** The full value React last wrote — what the segments were planned from. */
  readonly source: string
  /** What we truncated the host node to. */
  readonly prefix: string
  /** Inline span holding the chips and the prose between them. */
  readonly box: HTMLElement
  /**
   * Armed while our own truncation write is in flight, consumed by the record
   * it produces. Comparing values alone cannot tell that write from a host
   * rewrite that lands on the same prefix (inline markup closing right before
   * the directive, a regenerated message): swallowing the latter leaves the
   * old mirror on screen for good, because no further chunk repairs it.
   */
  selfWrite: boolean
}

/**
 * Mirrors owned by a host text node, keyed weakly so a removed message takes
 * its bookkeeping with it.
 */
const mirrors = new WeakMap<Text, Mirror>()
/** Chips placed beside a host `<code>` element, which React may delete alone. */
const codeChips = new WeakMap<Element, HTMLElement>()

/**
 * The mirror box of a host node, recovered from the DOM when the WeakMap is
 * empty: the Host re-evaluates client modules while the document stays put, so
 * a reload mid-stream must adopt the existing mirrors instead of adding a
 * second copy of the prose beside them.
 */
function mirrorBoxOf(node: Text): HTMLElement | null {
  const tracked = mirrors.get(node)
  if (tracked !== undefined) return tracked.box
  const next = node.nextElementSibling
  return next instanceof HTMLElement && next.hasAttribute(MIRROR) ? next : null
}

function retireMirror(node: Text, box: HTMLElement): void {
  mirrors.delete(node)
  box.remove()
}

/**
 * Decorate one text node without ever taking it out of the document.
 *
 * dsh renders a prose paragraph as `<p children={[...]}>`, so every run of text
 * is a React HostText fiber that the host rewrites in place (`nodeValue`) on
 * each streaming chunk. Replacing that node leaves React writing into a
 * detached target and everything after the directive disappears (issue #13).
 * Instead the host node keeps the prose before the first directive and we own
 * the siblings after it, re-planning them whenever React writes again.
 */
function decorateTextNode(node: Text): void {
  const value = node.nodeValue ?? ''
  const mirror = mirrors.get(node)
  // Skip our own truncation record, or the observer re-enters forever:
  // MutationObserver callbacks are microtasks, so the queue never drains and no
  // task, not even a DevTools evaluation, runs again. The flag is one-shot — a
  // host rewrite that happens to equal the prefix must still be re-planned.
  if (mirror !== undefined) {
    if (mirror.selfWrite) {
      mirror.selfWrite = false
      if (value === mirror.prefix) return
    } else if (value === mirror.source) {
      return
    }
  }
  if (!value.includes(':dsh-annotation{')) {
    const box = mirrorBoxOf(node)
    if (box !== null) retireMirror(node, box)
    return
  }
  const parent = node.parentElement
  if (!parent || parent.closest(`[data-${DECO}]`)) return
  // Never touch the composer: at send time the draft briefly holds the raw
  // protocol block, whose own header quotes `:dsh-annotation{index="N"}`. The
  // preview shows user-authored quote/comment text and must stay literal too.
  if (parent.closest('[data-dsq-toolbar], [data-dsq-chip-preview]')) return
  if (parent.closest('textarea, input, [data-lexical-editor="true"]')) return

  const split = splitDirectives(value)
  if (split === null) {
    const box = mirrorBoxOf(node)
    if (box !== null) retireMirror(node, box)
    return
  }
  const code = parent.closest('code')
  if (code !== null) {
    // Inline code is the one form React owns through `setTextContent`: its fast
    // path only applies while the element has a single Text child, so a mirror
    // inside it makes every chunk fall through to `code.textContent =` — which
    // wipes the chip and reports childList, not characterData. Wait for the
    // stream to end and swap the whole element then.
    if (parent.closest('[data-streaming]') !== null) return
    if (shouldChipCode(value, code.textContent, code.closest('pre') !== null)) {
      decorateCodeSpan(code, value)
    }
    return
  }
  // Fenced examples and files that merely mention the marker stay literal.
  if (parent.closest('pre')) return
  applyMirror(node, parent, value, split)
}

/**
 * Bring `box`'s children to `nodes` with the fewest DOM operations: an unchanged
 * run must not be rebuilt, because detaching a focused chip fires blur and
 * closes the preview the user is reading.
 */
function fillBox(box: HTMLElement, nodes: readonly (Text | HTMLElement)[]): void {
  let cursor: Node | null = box.firstChild
  for (const want of nodes) {
    if (want instanceof Text) {
      if (cursor instanceof Text && cursor.nodeValue === want.nodeValue) {
        cursor = cursor.nextSibling
        continue
      }
      box.insertBefore(want, cursor)
      continue
    }
    if (cursor === want) {
      cursor = cursor.nextSibling
      continue
    }
    box.insertBefore(want, cursor)
  }
  while (cursor !== null) {
    const next: Node | null = cursor.nextSibling
    box.removeChild(cursor)
    cursor = next
  }
}

function applyMirror(node: Text, parent: Element, source: string, split: DirectiveSplit): void {
  const box = mirrorBoxOf(node) ?? document.createElement('span')
  box.setAttribute(MIRROR, '')
  // Reuse chips by annotation index: rebuilding the node would drop the hover
  // preview's `activeChip` identity and interrupt a panel the user is reading.
  const reusable = new Map<number, HTMLElement>()
  for (const chip of box.querySelectorAll<HTMLElement>(`[data-${DECO}]`)) {
    const index = Number(chip.dataset[DECO_KEY])
    if (Number.isFinite(index) && !reusable.has(index)) reusable.set(index, chip)
  }
  const nodes: (Text | HTMLElement)[] = []
  for (const segment of split.segments) {
    if (segment.kind === 'text') {
      nodes.push(document.createTextNode(segment.text))
      continue
    }
    const chip = reusable.get(segment.index) ?? makeChip(segment.index)
    reusable.delete(segment.index)
    nodes.push(chip)
  }
  // Position and fill before truncating the host node. A throw in between then
  // duplicates text instead of deleting it, and React's next chunk repairs a
  // duplicate but never refills a hole.
  if (box.parentNode !== parent || box.previousSibling !== node) {
    parent.insertBefore(box, node.nextSibling)
  }
  fillBox(box, nodes)
  const record: Mirror = { source, prefix: split.prefix, box, selfWrite: false }
  mirrors.set(node, record)
  if (node.nodeValue !== split.prefix) {
    record.selfWrite = true
    node.nodeValue = split.prefix
  }
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
    // A burst of stream deltas can commit several times in one task, queuing
    // several characterData records for the same text node. Every one of them
    // describes a value already superseded by the node's final text, while our
    // own truncation record only arrives in the next callback. Plan each node
    // once, or a stale record consumes the one-shot self-write flag and the
    // truncation record is then misread as a host rewrite to the prefix —
    // which retires the mirror and drops the tail until the next chunk.
    const seenText = new Set<Text>()
    const endedStreaming = new Set<Element>()
    for (const record of records) {
      // Streaming lands as an in-place text mutation, and such records carry no
      // added nodes — walking only addedNodes leaves the raw directive on
      // screen until something re-creates the message DOM (a session switch,
      // say), which is exactly the "it works after I switch sessions" report.
      if (record.type === 'characterData') {
        if (record.target instanceof Text && !seenText.has(record.target)) {
          seenText.add(record.target)
          decorateTextNode(record.target)
        }
        continue
      }
      if (record.type === 'attributes') {
        // The deferred `<code>` form can only be swapped once the host stops
        // rewriting it; `data-streaming` coming off is that moment. Defer the
        // walk to the end of this callback: running it here could mirror a
        // node whose text record is still queued, and that stale record would
        // then eat the self-write flag (same failure as above).
        if (
          record.target instanceof Element &&
          record.attributeName === 'data-streaming' &&
          !record.target.hasAttribute('data-streaming')
        ) {
          endedStreaming.add(record.target)
        }
        continue
      }
      // React reconciles a paragraph's children by index: when a new inline
      // node appears it deletes the old Text fiber alone, leaving our mirrors
      // behind as duplicate prose. Retire them with their host node.
      for (const removed of record.removedNodes) {
        if (removed instanceof Text) {
          const mirror = mirrors.get(removed)
          if (mirror !== undefined) retireMirror(removed, mirror.box)
        } else if (removed instanceof Element) {
          const chip = codeChips.get(removed)
          if (chip !== undefined) {
            codeChips.delete(removed)
            chip.remove()
          }
        }
      }
      for (const node of record.addedNodes) {
        if (node instanceof Text) decorateTextNode(node)
        else if (node instanceof Element) decorateAnnotationDirectives(node)
      }
    }
    for (const ended of endedStreaming) decorateAnnotationDirectives(ended)
  })
  observer.observe(el, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['data-streaming'],
  })
  return () => observer.disconnect()
}
