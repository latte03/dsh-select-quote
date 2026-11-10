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
import { runtime } from '../runtime.ts'
import { badgeContainsPoint, badgeElementBox, badgeHitBox } from './badge-layout.ts'
import { placePopover } from './popoverPlacement.ts'
import { scrollToAnnotation } from './scrollToAnnotation.ts'
import { popoverEnter } from '../selection/popover-keys.ts'
import { t } from '../i18n.ts'
import {
  getAnnotations,
  getOutbound,
  removeAnnotation,
  removeOutboundRecord,
  updateAnnotationComment,
  updateHandoffComment,
} from '../state/annotation-store.ts'
import {
  groupHandoffs,
  handoffMarkIdOf,
  type HandoffGroup,
  type OutboundAnnotation,
} from '../state/handoff.ts'
import { A, cx, styles } from '../styles.ts'
import { appendLabel, appendText, iconActionButton, twoStepRemoveButton } from './chipPreviewDom.ts'
import {
  flashMessage,
  flowItem,
  isVisible,
  markByOwner,
  quoteCardFor,
  quotesOwnerBefore,
  quotesOwnerOf,
} from './preview-anchors.ts'
import { messageQuotes } from '../transcript/quote-registry.ts'
import { createKbd } from '../ui/Kbd.tsx'
import { isCoarsePointer } from '../ui/touch.ts'
import { showToast } from '../ui/toast.ts'
import {
  isSessionArchived,
  openConversation,
  openSourceAndLocate,
  sessionTitleOf,
  workspaceTitleOf,
} from '../selection/navigation.ts'
import type { AnnotationOrigin } from '../protocol/annotation-protocol.ts'

const HOVER_DELAY = 250
/** Just enough for the pointer to cross the 8px gap into the preview. */
const CLOSE_DELAY = 40
const GAP = 8
/** Matches the leaving keyframe; the node is detached after it finishes. */
const EXIT_MS = 120

let preview: HTMLDivElement | null = null
let jumpButton: HTMLButtonElement | null = null
let activeChip: HTMLElement | null = null
let activeMark: HTMLElement | null = null
let activeOwnerKey: string | null = null
let activeMessageId: string | null = null
let activeText = ''
let activeIndex = 0
/** Set when a chip resolves to a cross-session quote: the jump opens the source. */
let activeOrigin: AnnotationOrigin | null = null
let activeStart: number | undefined
let activeEnd: number | undefined
let pinned = false
/** An open inline comment editor pins the preview the way the summary does. */
let editingPreview = false
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
let markBindingCleanup: (() => void) | null = null

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

function cancelClose(): void {
  if (hideTimer !== 0) window.clearTimeout(hideTimer)
  hideTimer = 0
}

function scheduleClose(): void {
  cancelClose()
  if (pinned || editingPreview) return
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

function jumpToMark(event: MouseEvent): void {
  if (activeOrigin) {
    // Never close on a destination that cannot be opened: the preview is the
    // only place the archived state is explained.
    if (isSessionArchived(activeOrigin.sessionId)) {
      showToast(
        t('handoff.archived', {
          title: sessionTitleOf(activeOrigin.sessionId, activeOrigin.title),
        }),
      )
      return
    }
    const origin = activeOrigin
    const text = activeText
    const messageId = activeMessageId ?? undefined
    closeChipPreview(false)
    openSourceAndLocate({
      sessionId: origin.sessionId,
      text,
      ...(origin.handoffId ? { markId: handoffMarkIdOf(origin.handoffId) } : {}),
      sources: [
        {
          text,
          ...(messageId ? { messageId } : {}),
          ...(activeStart === undefined ? {} : { startOffset: activeStart }),
          ...(activeEnd === undefined ? {} : { endOffset: activeEnd }),
        },
      ],
    })
    return
  }
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

  if (isVisible(mark)) {
    closeChipPreview(false)
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

  // No visible mark (folded/collapsed): still land on the owning message even
  // when it currently measures zero, instead of giving up on the first test.
  const fallback = card?.isConnected ? card : ownerItem?.isConnected ? ownerItem : sourceItem?.isConnected ? sourceItem : null
  if (fallback) {
    closeChipPreview(false)
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

  // Last resort: the annotation's own text somewhere in the loaded transcript.
  if (text && scrollToAnnotation(index, text)) {
    closeChipPreview(false)
    return
  }

  // Nothing to jump to (the source turn is outside the loaded history). Keep
  // the preview open and say so; closing silently reads as a broken button.
  showToast(t('chip.jumpMissing'))
}

function buildPreview(
  index: number,
  quoteText: string,
  comment: string | null,
  withJump = true,
  pendingId?: string,
  origin?: AnnotationOrigin,
): HTMLDivElement {
  const box = document.createElement('div')
  box.className = cx(A.col, styles.chipPreview)
  box.setAttribute('data-dsq-chip-preview', 'true')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-label', t('chip.previewAria'))
  box.tabIndex = -1
  jumpButton = null

  const body = document.createElement('div')
  body.className = styles.chipPreviewBody
  body.style.animation = 'none'

  let currentComment = comment ?? ''
  let editing = false
  /**
   * Removing the focused textarea fires focusout synchronously; without this
   * guard the panel would read that as "focus left" and close right after save.
   */
  let rebuilding = false

  const renderHead = (): HTMLElement => {
    const head = document.createElement('div')
    head.className = cx(A.row, styles.chipPreviewHead)
    const title = document.createElement('span')
    title.className = styles.chipPreviewTitle
    title.textContent = t('chip.annotation', { index })
    head.append(title)
    if (editing) return head

    const actions = document.createElement('div')
    actions.className = cx(A.row, styles.chipPreviewActions)
    if (withJump) {
      const archived =
        origin !== undefined && isSessionArchived(origin.sessionId)
          ? t('handoff.archived', {
              title: sessionTitleOf(origin.sessionId, origin.title),
            })
          : undefined
      // Same icon-button skin as edit/remove, so the title row reads as one row.
      jumpButton = iconActionButton(
        'arrow-up-right',
        archived ?? t('chip.jumpAria'),
        archived ? undefined : jumpToMark,
      )
      jumpButton.setAttribute('data-dsq-chip-jump', 'true')
      if (archived !== undefined) jumpButton.disabled = true
      actions.append(jumpButton)
    }
    // Only the composer's pending annotations can be changed here: a durable
    // mark belongs to a sent message, whose quote is history, not editable.
    if (pendingId !== undefined) {
      actions.append(
        iconActionButton('pencil', t('summary.edit', { index }), enterEdit),
        twoStepRemoveButton({
          label: t('summary.remove', { index }),
          confirmLabel: t('handoff.confirmRemove'),
          onConfirm: () => {
            removeAnnotation(undefined, pendingId)
            closeChipPreview(false)
          },
        }),
      )
    }
    if (actions.childElementCount > 0) head.append(actions)
    return head
  }

  const renderView = (): void => {
    body.replaceChildren()
    body.append(renderHead())
    appendLabel(body, t('common.selectedText'))
    appendText(body, styles.chipPreviewQuote, quoteText)
    if (currentComment !== '') {
      appendLabel(body, t('summary.userComment'))
      appendText(body, styles.chipPreviewComment, currentComment)
    }
  }

  function enterEdit(): void {
    editing = true
    editingPreview = true
    body.replaceChildren()
    body.append(renderHead())
    appendText(body, styles.chipPreviewQuote, quoteText)
    appendLabel(body, t('summary.userComment'))

    const area = document.createElement('textarea')
    area.className = cx(A.box, styles.annEditInput)
    area.placeholder = t('common.commentPlaceholder')
    area.value = currentComment
    area.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        exitEdit()
        return
      }
      // Same submit gesture as the toolbar's comment box and the host
      // composer: Enter / Ctrl+Enter / Cmd+Enter save, Shift+Enter breaks.
      if (popoverEnter(event) !== 'submit') return
      event.preventDefault()
      event.stopPropagation()
      commitEdit()
    })
    body.append(area)

    const actions = document.createElement('div')
    actions.className = cx(A.row, styles.annEditActions)
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = cx(A.plain, styles.annEditCancel)
    cancel.textContent = t('common.cancel')
    cancel.addEventListener('click', exitEdit)
    const save = document.createElement('button')
    save.type = 'button'
    save.className = cx(A.plain, A.inlineRow, styles.annEditSave)
    save.setAttribute('aria-keyshortcuts', 'Enter')
    save.textContent = t('common.save')
    if (!isCoarsePointer()) {
      save.style.gap = '5px'
      save.append(createKbd())
    }
    save.addEventListener('click', commitEdit)
    actions.append(cancel, save)
    body.append(actions)

    scheduleReposition()
    window.setTimeout(() => area.focus({ preventScroll: true }), 0)
  }

  const rebuild = (): void => {
    rebuilding = true
    renderView()
    scheduleReposition()
    box.focus({ preventScroll: true })
    window.setTimeout(() => {
      rebuilding = false
    }, 0)
  }

  function exitEdit(): void {
    editing = false
    editingPreview = false
    rebuild()
  }

  function commitEdit(): void {
    if (!editing) return
    const area = body.querySelector('textarea')
    currentComment = (area?.value ?? currentComment).trim()
    if (pendingId !== undefined) updateAnnotationComment(undefined, pendingId, currentComment)
    editing = false
    editingPreview = false
    rebuild()
  }

  renderView()
  box.append(body)

  box.addEventListener('pointerenter', cancelClose)
  box.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return
    scheduleClose()
  })
  box.addEventListener('focusout', (event) => {
    // Editing owns the panel until save/cancel/Escape, like the summary list;
    // the rebuild after either action removes the focused box on purpose.
    if (editing || rebuilding) return
    const next = event.relatedTarget
    if (next instanceof Node && (box.contains(next) || activeChip?.contains(next))) return
    closeChipPreview(false)
  })
  box.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (editing) {
      exitEdit()
      return
    }
    closeChipPreview(true)
  })

  return box
}

/** Show and watch one preview; `activeChip` is the element it belongs to. */
function mountPreview(box: HTMLDivElement, anchor: DOMRect): void {
  preview = box
  box.style.visibility = 'hidden'
  document.body.append(box)
  // Keep the flex display while measuring; toggling display changes wrapping
  // and produces a shorter panel than the one actually painted.
  const panel = { width: box.offsetWidth || 320, height: box.offsetHeight || 180 }
  const { top, left } = placePopover(anchor, panel, 'top', GAP)
  box.style.top = `${top}px`
  box.style.left = `${left}px`
  box.style.visibility = ''
  const animated = box.querySelector<HTMLElement>(`.${styles.chipPreviewBody}`)
  if (animated) animated.style.animation = ''

  onDocPointerDown = (event) => {
    // An open editor keeps its draft; outside presses do not dismiss it.
    if (editingPreview) return
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
  activeOrigin = quote?.origin ?? null
  activeStart = quote?.startOffset
  activeEnd = quote?.endOffset
  if (activeOrigin && isSessionArchived(activeOrigin.sessionId)) {
    showToast(t('handoff.archived', { title: sessionTitleOf(activeOrigin.sessionId, activeOrigin.title) }))
  }
  pinned = nextPinned

  const box = buildPreview(
    index,
    text,
    quote ? (quote.comment ?? '').trim() : null,
    true,
    undefined,
    activeOrigin ?? undefined,
  )
  mountPreview(box, chip.getBoundingClientRect())
}

interface MarkAnnotation {
  readonly text: string
  readonly comment: string
  readonly ownerKey: string | null
  readonly messageId: string | null
  /** Pending composer entry: present only when this annotation is still editable. */
  readonly pendingId: string | null
}

/**
 * Resolve the annotation behind a transcript mark. Durable marks carry a
 * `dqsm_` id and read their quote from the user turn's registry; pending marks
 * carry the store id and read the live list, so a comment edited after
 * decoration still shows up.
 */
function annotationOfMark(mark: HTMLElement): MarkAnnotation | null {
  const id = mark.getAttribute('data-dsq-ann-mark') ?? ''
  const index = Number(mark.getAttribute('data-dsq-ann-index') ?? 0)
  if (index <= 0) return null
  if (id.startsWith('dqsm_')) {
    const ownerKey = quotesOwnerOf(mark)
    const quote = ownerKey ? messageQuotes(ownerKey)?.[index - 1] : undefined
    if (!ownerKey || !quote) return null
    const text = quote.text.trim()
    return text
      ? {
          text,
          comment: (quote.comment ?? '').trim(),
          ownerKey,
          messageId: quote.messageId ?? null,
          pendingId: null,
        }
      : null
  }
  const item = getAnnotations().find((annotation) => annotation.id === id)
  if (!item) return null
  const text = item.text.trim()
  return text
    ? {
        text,
        comment: (item.comment ?? '').trim(),
        ownerKey: null,
        messageId: item.sources[0]?.messageId ?? null,
        pendingId: item.id,
      }
    : null
}

function buildHandoffPreview(group: HandoffGroup): HTMLDivElement {
  const box = document.createElement('div')
  box.className = cx(A.col, styles.chipPreview)
  box.setAttribute('data-dsq-chip-preview', 'true')
  box.setAttribute('data-dsq-handoff-preview', 'true')
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-label', t('handoff.previewTitle'))
  box.tabIndex = -1

  const body = document.createElement('div')
  body.className = styles.chipPreviewBody
  body.style.animation = 'none'

  let editingId: string | null = null

  /** Re-read the store: edits and removals may have landed in another surface. */
  const currentGroup = (): HandoffGroup =>
    groupHandoffs(getOutbound()).find((entry) => entry.markId === group.markId) ?? group

  const closeAfterRemoval = (): void => {
    const mark = activeChip
    closeChipPreview(false)
    // Rebuild the group; when the last target went, no preview returns.
    if (mark) window.setTimeout(() => showHandoffPreview(mark, false), 0)
  }

  const removeRecord = (record: OutboundAnnotation): void => {
    const sourceId = runtime.sessionId
    const paired = sourceId ? removeOutboundRecord(sourceId, record.id) : false
    if (!paired) showToast(t('handoff.targetGone'))
    showToast(t('handoff.removed'))
    closeAfterRemoval()
  }

  /** Icon actions shared by the header (single target) and each row. */
  const actionButtons = (record: OutboundAnnotation): HTMLButtonElement[] => {
    const name = sessionTitleOf(record.destination.sessionId, record.destination.title)
    const archived = isSessionArchived(record.destination.sessionId)
    const buttons: HTMLButtonElement[] = []

    if (record.state === 'pending') {
      buttons.push(
        iconActionButton('pencil', t('handoff.edit'), () => {
          editingId = record.id
          editingPreview = true
          render()
        }),
      )
    }

    const go = iconActionButton(
      'arrow-up-right',
      archived ? t('handoff.archived', { title: name }) : t('handoff.go'),
      archived ? undefined : () => openConversation(record.destination.sessionId),
    )
    if (archived) go.disabled = true
    buttons.push(go)

    if (record.state === 'pending') {
      buttons.push(
        twoStepRemoveButton({
          label: t('handoff.cancelPut'),
          confirmLabel: t('handoff.confirmRemove'),
          onConfirm: () => removeRecord(record),
        }),
      )
    }
    return buttons
  }

  const actionRow = (record: OutboundAnnotation): HTMLElement => {
    const actions = document.createElement('div')
    actions.className = cx(A.row, styles.chipPreviewActions)
    actions.append(...actionButtons(record))
    return actions
  }

  const renderHead = (current: HandoffGroup): HTMLElement => {
    const head = document.createElement('div')
    head.className = cx(A.row, styles.chipPreviewHead)
    const title = document.createElement('span')
    title.className = styles.chipPreviewTitle
    title.textContent = t('handoff.previewTitle')
    head.append(title)
    // A single target owns the top-right corner; with several targets each row
    // carries its own actions instead.
    if (!editingId && current.records.length === 1) {
      const record = current.records[0]
      if (record) head.append(actionRow(record))
    }
    return head
  }

  const renderEdit = (record: OutboundAnnotation): void => {
    appendText(body, styles.chipPreviewQuote, record.text)
    appendLabel(body, t('summary.userComment'))

    const area = document.createElement('textarea')
    area.className = cx(A.box, styles.annEditInput)
    area.placeholder = t('common.commentPlaceholder')
    area.value = record.comment ?? ''
    area.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        cancelEdit()
        return
      }
      if (popoverEnter(event) !== 'submit') return
      event.preventDefault()
      event.stopPropagation()
      commitEdit(record, area.value)
    })
    body.append(area)

    const actions = document.createElement('div')
    actions.className = cx(A.row, styles.annEditActions)
    const cancel = document.createElement('button')
    cancel.type = 'button'
    cancel.className = cx(A.plain, styles.annEditCancel)
    cancel.textContent = t('common.cancel')
    cancel.addEventListener('click', cancelEdit)
    const save = document.createElement('button')
    save.type = 'button'
    save.className = cx(A.plain, A.inlineRow, styles.annEditSave)
    save.setAttribute('aria-keyshortcuts', 'Enter')
    save.textContent = t('common.save')
    if (!isCoarsePointer()) {
      save.style.gap = '5px'
      save.append(createKbd())
    }
    save.addEventListener('click', () => commitEdit(record, area.value))
    actions.append(cancel, save)
    body.append(actions)

    scheduleReposition()
    window.setTimeout(() => area.focus({ preventScroll: true }), 0)
  }

  function cancelEdit(): void {
    editingId = null
    editingPreview = false
    render()
  }

  function commitEdit(record: OutboundAnnotation, value: string): void {
    const sourceId = runtime.sessionId
    if (sourceId) updateHandoffComment(sourceId, record.id, value)
    editingId = null
    editingPreview = false
    render()
  }

  const renderRow = (record: OutboundAnnotation, withActions: boolean): HTMLElement => {
    const row = document.createElement('div')
    row.className = styles.handoffRow
    if (withActions) {
      const rowHead = document.createElement('div')
      rowHead.className = styles.handoffRowHead
      rowHead.append(actionRow(record))
      row.append(rowHead)
    }
    // Destination, workspace and status share one subdued line. The workspace
    // is dropped when it duplicates the session title (auto-titled sessions
    // often carry the project name), so the line never repeats itself.
    const name = sessionTitleOf(record.destination.sessionId, record.destination.title)
    const workspace = workspaceTitleOf(record.destination.workspaceId)
    const meta = [
      name,
      workspace === name ? '' : workspace,
      record.state === 'sent' ? t('handoff.sent') : t('handoff.pending'),
    ].filter((part) => part !== '')
    appendLabel(row, meta.join(' · '))
    if (record.comment) {
      appendText(row, styles.chipPreviewComment, record.comment)
    }
    return row
  }

  function render(): void {
    const current = currentGroup()
    if (editingId !== null && !current.records.some((entry) => entry.id === editingId)) {
      editingId = null
      editingPreview = false
    }
    body.replaceChildren()
    body.append(renderHead(current))
    const editing = current.records.find((entry) => entry.id === editingId)
    if (editing) {
      renderEdit(editing)
      return
    }
    appendLabel(body, t('common.selectedText'))
    appendText(body, styles.chipPreviewQuote, current.text)
    const single = current.records.length === 1
    for (const record of current.records) body.append(renderRow(record, !single))
    scheduleReposition()
  }

  render()
  box.append(body)

  box.addEventListener('pointerenter', cancelClose)
  box.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'touch') return
    scheduleClose()
  })
  box.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    event.stopPropagation()
    if (editingId !== null) {
      cancelEdit()
      return
    }
    closeChipPreview(true)
  })
  return box
}

/** Arrow mark preview: every destination of one selection, status and actions. */
function showHandoffPreview(mark: HTMLElement, focus: boolean): void {
  if (!mark.isConnected) return
  const markId = mark.getAttribute('data-dsq-ann-mark') ?? ''
  const group = groupHandoffs(getOutbound()).find((entry) => entry.markId === markId)
  if (!group) return
  // One notice per opening when a destination went to the archive: the rows
  // stay (records are kept) but 前往 is disabled with a tooltip.
  const archived = group.records.find((record) => isSessionArchived(record.destination.sessionId))
  if (archived) {
    showToast(
      t('handoff.archived', {
        title: sessionTitleOf(archived.destination.sessionId, archived.destination.title),
      }),
    )
  }
  if (activeChip === mark && preview) {
    pinned = true
    return
  }
  cancelTimers()
  closeChipPreview(false)
  flushLeavingPreview()
  activeChip = mark
  activeMark = mark
  activeOwnerKey = null
  activeMessageId = group.messageId || null
  activeText = group.text
  activeIndex = 0
  activeOrigin = null
  activeStart = group.startOffset
  activeEnd = group.endOffset
  pinned = true
  const box = buildHandoffPreview(group)
  mountPreview(box, mark.getBoundingClientRect())
  if (focus) box.focus({ preventScroll: true })
}

function showMarkPreview(mark: HTMLElement, focus: boolean): void {
  if (!mark.isConnected) return
  const index = Number(mark.getAttribute('data-dsq-ann-index') ?? 0)
  if (index <= 0) return
  if (activeChip === mark && preview) {
    pinned = true
    return
  }
  const data = annotationOfMark(mark)
  if (!data) return
  cancelTimers()
  closeChipPreview(false)
  flushLeavingPreview()
  activeChip = mark
  activeMark = mark
  activeOwnerKey = data.ownerKey
  activeMessageId = data.messageId
  activeText = data.text
  activeIndex = index
  activeOrigin = null
  pinned = true
  // The mark is already in view, so the preview has nothing to jump to.
  const box = buildPreview(index, data.text, data.comment, false, data.pendingId ?? undefined)
  mountPreview(box, mark.getBoundingClientRect())
  if (focus) box.focus({ preventScroll: true })
}

/**
 * Click/keyboard previews for the ordinal badge fragments in transcript
 * marks. Delegated on the document: marks are replaced by host re-renders and
 * binding every fragment would leak listeners across those passes.
 */
export function bindAnnotationMarkPreview(): () => void {
  if (typeof document === 'undefined') return () => {}
  if (markBindingCleanup) return markBindingCleanup
  const markOf = (target: EventTarget | null): HTMLElement | null => {
    if (!(target instanceof Element)) return null
    return target.closest<HTMLElement>('[data-dsq-ann-mark]')
  }
  const onClick = (event: MouseEvent): void => {
    const mark = markOf(event.target)
    if (!mark) return
    const arrow = mark.hasAttribute('data-dsq-ann-arrow')
    const index = Number(mark.getAttribute('data-dsq-ann-index'))
    if (!arrow && (!Number.isFinite(index) || index <= 0)) return
    // The badge is the only click target; the marked prose stays selectable.
    // Keyboard/AT activation reports detail 0 and no usable coordinates.
    if (event.detail !== 0) {
      // Hit-test against the badge element's own rect: it is painted at
      // coordinates measured by `placeBadge()`, so the box is exact, while a
      // geometric reconstruction from the mark's rect drifts on a wrapped mark
      // (that rect is the union of the line fragments). Marks whose badge has
      // not been attached yet keep the reconstructed box.
      const badge = mark.querySelector<HTMLElement>(`.${styles.annBadge}`)
      const badgeRect = badge?.getBoundingClientRect()
      const box =
        badgeRect !== undefined && (badgeRect.width > 0 || badgeRect.height > 0)
          ? badgeElementBox(badgeRect)
          : (() => {
              const offset = {
                dx: Number.parseFloat(mark.style.getPropertyValue('--dsq-ann-badge-x')) || 0,
                dy: Number.parseFloat(mark.style.getPropertyValue('--dsq-ann-badge-y')) || 0,
              }
              return badgeHitBox(mark.getBoundingClientRect(), arrow ? 0 : index, offset)
            })()
      if (!badgeContainsPoint(box, event.clientX, event.clientY)) return
    }
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed) return
    if (arrow) showHandoffPreview(mark, false)
    else showMarkPreview(mark, false)
  }
  const onKeyDown = (event: KeyboardEvent): void => {
    const mark = markOf(event.target)
    if (!mark) return
    if (event.key === 'Escape' && preview !== null) {
      event.preventDefault()
      closeChipPreview(true)
      return
    }
    if (
      (event.key === 'Enter' || event.key === ' ') &&
      (mark.hasAttribute('data-dsq-ann-index') || mark.hasAttribute('data-dsq-ann-arrow'))
    ) {
      event.preventDefault()
      if (mark.hasAttribute('data-dsq-ann-arrow')) showHandoffPreview(mark, true)
      else showMarkPreview(mark, true)
    }
  }
  document.addEventListener('click', onClick)
  document.addEventListener('keydown', onKeyDown)
  const cleanup = (): void => {
    document.removeEventListener('click', onClick)
    document.removeEventListener('keydown', onKeyDown)
    markBindingCleanup = null
  }
  markBindingCleanup = cleanup
  return cleanup
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
  activeOrigin = null
  activeStart = undefined
  activeEnd = undefined
  pinned = false
  editingPreview = false
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
