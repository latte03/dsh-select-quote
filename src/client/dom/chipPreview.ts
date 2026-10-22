/**
 * Hover/focus/click preview for `:dsh-annotation{index="N"}` chips.
 *
 * The chip decorator is plain DOM, so the preview is too. One body-level
 * preview is reused for every chip: `contain: layout` surfaces in the
 * transcript would otherwise become the containing block of a fixed popover.
 *
 * Clicking the chip no longer jumps: it pins the preview, and the preview's
 * button owns the jump (same contract on touch, where there is no hover).
 */

import { findAnnotationMarkBefore, flashAnnotationMark } from './annotate-text.ts'
import { placePopover } from './popoverPlacement.ts'
import { scrollToAnnotation } from './scrollToAnnotation.ts'
import { t } from '../i18n.ts'
import { A, cx, styles } from '../styles.ts'
import { messageQuotes } from '../transcript/quote-registry.ts'

const HOVER_DELAY = 250
/** Just enough for the pointer to cross the 8px gap into the preview. */
const CLOSE_DELAY = 40
const GAP = 8
/** Matches the leaving keyframe; the node is detached after it finishes. */
const EXIT_MS = 120
const JUMP_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 7h10v10"/><path d="M7 17 17 7"/></svg>'

let preview: HTMLDivElement | null = null
let jumpButton: HTMLButtonElement | null = null
let activeChip: HTMLElement | null = null
let activeMark: HTMLElement | null = null
let activeOwnerKey: string | null = null
let activeMessageId: string | null = null
let activeText = ''
let activeIndex = 0
let pinned = false
let showTimer = 0
let hideTimer = 0
let frame = 0
let suppressFocusOpen = false
let observer: MutationObserver | null = null
let onDocPointerDown: ((event: PointerEvent) => void) | null = null
let onScroll: (() => void) | null = null
let onResize: (() => void) | null = null
let leavingBox: HTMLDivElement | null = null
let leavingTimer = 0

function cancelTimers(): void {
  if (showTimer !== 0) window.clearTimeout(showTimer)
  if (hideTimer !== 0) window.clearTimeout(hideTimer)
  showTimer = 0
  hideTimer = 0
}

/** A new preview replaces any panel still animating out. */
function flushLeavingPreview(): void {
  if (leavingTimer !== 0) {
    window.clearTimeout(leavingTimer)
    leavingTimer = 0
  }
  leavingBox?.remove()
  leavingBox = null
}

function animatePreviewOut(box: HTMLDivElement): void {
  flushLeavingPreview()
  // Do not leave focus inside an aria-hidden, pointer-inert node.
  const active = document.activeElement
  if (active instanceof HTMLElement && box.contains(active)) active.blur()
  box.classList.add(styles.chipPreviewLeaving)
  box.setAttribute('aria-hidden', 'true')
  leavingBox = box
  leavingTimer = window.setTimeout(() => {
    leavingTimer = 0
    if (leavingBox === box) leavingBox = null
    box.remove()
  }, EXIT_MS)
}

/**
 * The annotated text can sit in an earlier assistant turn while the quotes were
 * serialized into the user turn that sent them. The mark id is built by
 * `TranscriptQuoteCard` as `dqsm_<ownerFlowKey>_<zeroBasedIndex>`, so it — not
 * the mark's physical ancestor — names the message that owns the quotes.
 */
function quotesOwnerOf(mark: HTMLElement | null): string | null {
  if (!mark) return null
  const id = mark.getAttribute('data-dsq-ann-mark') ?? ''
  const match = /^dqsm_(.+)_\d+$/.exec(id)
  return match ? match[1] : null
}

/** The quote card for the user turn that sent the annotation, before the chip. */
function quotesOwnerBefore(chip: HTMLElement, index: number): string | null {
  const cards = [...document.querySelectorAll<HTMLElement>('.dsq_tSummary')]
  for (let i = cards.length - 1; i >= 0; i -= 1) {
    const card = cards[i]
    if ((card.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING) === 0) continue
    const ownerKey = card.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key')
    if (ownerKey && messageQuotes(ownerKey)?.[index - 1]) return ownerKey
  }
  return null
}

function markByOwner(ownerKey: string, index: number): HTMLElement | null {
  const id = `dqsm_${ownerKey}_${index - 1}`
  const marks = [...document.querySelectorAll<HTMLElement>('[data-dsq-ann-mark]')].filter(
    (mark) => mark.getAttribute('data-dsq-ann-mark') === id,
  )
  return (
    marks.find((mark) => mark.getAttribute('data-dsq-ann-index') === String(index)) ??
    marks[0] ??
    null
  )
}

function flowItem(messageId: string): HTMLElement | null {
  for (const item of document.querySelectorAll<HTMLElement>('[data-chat-flow-key]')) {
    if (item.getAttribute('data-chat-flow-key') === messageId) return item
  }
  return null
}

function quoteCardFor(ownerKey: string): HTMLElement | null {
  for (const card of document.querySelectorAll<HTMLElement>('.dsq_tSummary')) {
    if (card.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key') === ownerKey) {
      return card
    }
  }
  return null
}

function isVisible(el: HTMLElement | null): el is HTMLElement {
  if (!el?.isConnected) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function flashMessage(el: HTMLElement): void {
  el.classList.add(styles.annMessageFlash)
  window.setTimeout(() => el.classList.remove(styles.annMessageFlash), 1400)
}

function cancelClose(): void {
  if (hideTimer !== 0) window.clearTimeout(hideTimer)
  hideTimer = 0
}

function scheduleClose(): void {
  cancelClose()
  if (pinned) return
  hideTimer = window.setTimeout(() => closeChipPreview(false), CLOSE_DELAY)
}

function scheduleShow(chip: HTMLElement, index: number): void {
  cancelTimers()
  showTimer = window.setTimeout(() => showChipPreview(chip, index, false), HOVER_DELAY)
}

function scheduleReposition(): void {
  if (frame !== 0) return
  frame = window.requestAnimationFrame(() => {
    frame = 0
    reposition()
  })
}

function reposition(): void {
  if (!preview || !activeChip) return
  if (!activeChip.isConnected) {
    closeChipPreview(false)
    return
  }
  const anchor = activeChip.getBoundingClientRect()
  if (anchor.bottom < 0 || anchor.top > window.innerHeight) {
    closeChipPreview(false)
    return
  }
  const panel = { width: preview.offsetWidth || 320, height: preview.offsetHeight || 180 }
  const { top, left } = placePopover(anchor, panel, 'top', GAP)
  preview.style.top = `${top}px`
  preview.style.left = `${left}px`
}

function appendLabel(parent: HTMLElement, text: string): void {
  const label = document.createElement('div')
  label.className = styles.chipPreviewLabel
  label.textContent = text
  parent.append(label)
}

function appendText(parent: HTMLElement, className: string, text: string): void {
  const node = document.createElement('div')
  node.className = className
  node.textContent = text
  parent.append(node)
}

function jumpToMark(event: MouseEvent): void {
  const ownerKey = activeOwnerKey
  const messageId = activeMessageId
  const text = activeText
  const index = activeIndex
  const keyboard = event.detail === 0
  let mark = activeMark?.isConnected ? activeMark : null
  if (!mark && ownerKey) mark = markByOwner(ownerKey, index)
  const card = ownerKey ? quoteCardFor(ownerKey) : null
  const ownerItem = ownerKey ? flowItem(ownerKey) : null
  const sourceItem = messageId ? flowItem(messageId) : null
  closeChipPreview(false)

  if (isVisible(mark)) {
    mark.tabIndex = -1
    flashAnnotationMark(mark)
    // Focus after the smooth scroll instead of interrupting it.
    if (keyboard) {
      window.setTimeout(() => {
        if (mark.isConnected) mark.focus({ preventScroll: true })
      }, 450)
    }
    return
  }

  // No visible mark (removed, folded, or no longer rendered): go to the
  // nearest thing that still exists, and make the landing visible.
  const fallback = isVisible(card) ? card : ownerItem ?? sourceItem
  if (fallback) {
    fallback.scrollIntoView({ block: 'center', behavior: 'smooth' })
    flashMessage(fallback)
    if (keyboard) {
      window.setTimeout(() => {
        if (!fallback.isConnected) return
        const next = fallback.querySelector<HTMLElement>('button, [tabindex]') ?? fallback
        if (next === fallback) fallback.tabIndex = -1
        next.focus({ preventScroll: true })
      }, 450)
    }
    return
  }
  if (text) scrollToAnnotation(index, text)
}

function buildPreview(index: number, quoteText: string, comment: string | null): HTMLDivElement {
  const box = document.createElement('div')
  box.className = cx(A.col, styles.chipPreview)
  box.setAttribute('data-dsq-chip-preview', 'true')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-label', t('chip.previewAria'))

  const body = document.createElement('div')
  body.className = styles.chipPreviewBody
  body.style.animation = 'none'

  const head = document.createElement('div')
  head.className = cx(A.row, styles.chipPreviewHead)
  const title = document.createElement('span')
  title.className = styles.chipPreviewTitle
  title.textContent = t('chip.annotation', { index })

  jumpButton = document.createElement('button')
  jumpButton.type = 'button'
  jumpButton.className = cx(A.plain, A.inlineRow, styles.chipPreviewJump)
  jumpButton.setAttribute('data-dsq-chip-jump', 'true')
  jumpButton.setAttribute('aria-label', t('chip.jumpAria'))
  jumpButton.title = t('chip.jumpAria')
  jumpButton.insertAdjacentHTML('afterbegin', JUMP_ICON)
  const jumpLabel = document.createElement('span')
  jumpLabel.textContent = t('chip.jump')
  jumpButton.append(jumpLabel)
  jumpButton.addEventListener('click', jumpToMark)
  head.append(title, jumpButton)
  body.append(head)

  appendLabel(body, t('common.selectedText'))
  appendText(body, styles.chipPreviewQuote, quoteText)
  if (comment !== null) {
    appendLabel(body, t('summary.userComment'))
    appendText(
      body,
      cx(styles.chipPreviewComment, comment === '' && styles.chipPreviewCommentEmpty),
      comment === '' ? t('summary.noComment') : comment,
    )
  }
  box.append(body)

  box.addEventListener('pointerenter', cancelClose)
  box.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return
    scheduleClose()
  })
  box.addEventListener('focusout', (event) => {
    const next = event.relatedTarget
    if (next instanceof Node && (box.contains(next) || activeChip?.contains(next))) return
    closeChipPreview(false)
  })
  box.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    closeChipPreview(true)
  })

  return box
}

function showChipPreview(chip: HTMLElement, index: number, nextPinned: boolean): void {
  cancelTimers()
  if (!chip.isConnected) return
  let mark = findAnnotationMarkBefore(index, chip)
  let ownerKey =
    quotesOwnerOf(mark) ??
    mark?.closest('[data-chat-flow-key]')?.getAttribute('data-chat-flow-key') ??
    null
  let quote = ownerKey ? messageQuotes(ownerKey)?.[index - 1] : undefined
  if (!quote) {
    const fallbackKey = quotesOwnerBefore(chip, index)
    if (fallbackKey) {
      ownerKey = fallbackKey
      quote = messageQuotes(fallbackKey)?.[index - 1]
    }
  }
  if (ownerKey) {
    const exact = markByOwner(ownerKey, index)
    if (exact) mark = exact
    // A mark from a different owner is not the target this preview resolved;
    // fall through to the message-level jump instead of flashing the wrong one.
    else if (quotesOwnerOf(mark) !== ownerKey) mark = null
  }
  const text = (quote?.text ?? mark?.textContent ?? '').trim()
  if (text === '') return

  if (activeChip === chip && preview) {
    pinned = pinned || nextPinned
    return
  }

  closeChipPreview(false)
  flushLeavingPreview()
  activeChip = chip
  activeMark = mark
  activeOwnerKey = ownerKey
  activeMessageId = quote?.messageId ?? null
  activeText = text
  activeIndex = index
  pinned = nextPinned

  const box = buildPreview(index, text, quote ? (quote.comment ?? '').trim() : null)
  preview = box
  box.style.visibility = 'hidden'
  document.body.append(box)
  // Keep the flex display while measuring; toggling display changes wrapping
  // and produces a shorter panel than the one actually painted.
  const panel = { width: box.offsetWidth || 320, height: box.offsetHeight || 180 }
  const anchor = chip.getBoundingClientRect()
  const { top, left } = placePopover(anchor, panel, 'top', GAP)
  box.style.top = `${top}px`
  box.style.left = `${left}px`
  box.style.visibility = ''
  const animated = box.querySelector<HTMLElement>(`.${styles.chipPreviewBody}`)
  if (animated) animated.style.animation = ''

  onDocPointerDown = (event) => {
    const target = event.target
    if (!(target instanceof Node)) return
    if (box.contains(target) || activeChip?.contains(target)) return
    closeChipPreview(false)
  }
  document.addEventListener('pointerdown', onDocPointerDown, true)

  onScroll = scheduleReposition
  document.addEventListener('scroll', onScroll, true)
  onResize = scheduleReposition
  window.addEventListener('resize', onResize)

  observer = new MutationObserver(() => {
    if (activeChip && !activeChip.isConnected) closeChipPreview(false)
  })
  observer.observe(document.body, { childList: true, subtree: true })
}

/** Close the preview. `restoreFocus` is for a deliberate Escape. */
export function closeChipPreview(restoreFocus: boolean): void {
  const box = preview
  const chip = activeChip
  cancelTimers()
  if (frame !== 0) {
    window.cancelAnimationFrame(frame)
    frame = 0
  }
  if (observer) {
    observer.disconnect()
    observer = null
  }
  if (onDocPointerDown) {
    document.removeEventListener('pointerdown', onDocPointerDown, true)
    onDocPointerDown = null
  }
  if (onScroll) {
    document.removeEventListener('scroll', onScroll, true)
    onScroll = null
  }
  if (onResize) {
    window.removeEventListener('resize', onResize)
    onResize = null
  }
  // Clear state before detaching: removing the focused jump button fires
  // focusout, whose handler re-enters this function. Letting that call remove
  // the node a second time while the first removal is still running throws
  // NotFoundError.
  preview = null
  jumpButton = null
  activeChip = null
  activeMark = null
  activeOwnerKey = null
  activeMessageId = null
  activeText = ''
  activeIndex = 0
  pinned = false
  // Focus before retiring the preview: the focused button lives inside it, and
  // removing it would hand focus to <body>. The chip's focus handler must not
  // re-open what Escape is closing.
  if (restoreFocus && chip?.isConnected) {
    suppressFocusOpen = true
    chip.focus({ preventScroll: true })
  }
  if (box) animatePreviewOut(box)
  suppressFocusOpen = false
}

/** Bind the preview to a freshly decorated chip. Safe to call twice. */
export function bindChipPreview(chip: HTMLElement, index: number): void {
  if (chip.dataset.dsqChipPreviewBound === 'true') return
  chip.dataset.dsqChipPreviewBound = 'true'

  chip.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch') return
    if (activeChip === chip && preview) {
      // Coming back from the preview crosses the gap; keep the current one.
      cancelClose()
      return
    }
    scheduleShow(chip, index)
  })
  chip.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return
    scheduleClose()
  })
  chip.addEventListener('focus', () => {
    if (suppressFocusOpen) return
    showChipPreview(chip, index, true)
  })
  chip.addEventListener('blur', (event) => {
    const next = event.relatedTarget
    if (next instanceof Node && (preview?.contains(next) || chip.contains(next))) return
    closeChipPreview(false)
  })
  chip.addEventListener('click', () => showChipPreview(chip, index, true))
  chip.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (activeChip !== chip) return
      event.preventDefault()
      closeChipPreview(true)
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      showChipPreview(chip, index, true)
      jumpButton?.focus()
    }
  })
}
