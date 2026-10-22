import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { placePopover } from '../dom/popoverPlacement.ts'
import { A, cx, styles } from '../styles.ts'
import { LucideIcon } from './icons.tsx'
import { t } from '../i18n.ts'
import { useLocale } from '../useLocale.ts'

export interface AnnotationSummaryItem {
  readonly id?: string
  readonly title: string
  readonly text: string
  readonly comment?: string
}

export interface AnnotationSummaryProps {
  readonly count: number
  readonly items: readonly AnnotationSummaryItem[]
  readonly onRemoveAll?: () => void
  readonly onItemSelect?: (index: number, item: AnnotationSummaryItem) => void
  /** Composer only: remove one pending annotation. */
  readonly onItemRemove?: (index: number, item: AnnotationSummaryItem) => void
  /** Composer only: persist one pending annotation's new comment. */
  readonly onItemEdit?: (index: number, item: AnnotationSummaryItem, comment: string) => void
}

/** Grace period so pointer transit between the summary and the panel never closes it. */
const CLOSE_DELAY = 320
/** After a viewport change, wait this long before position-checking the pointer. */
const SETTLE_DELAY = 600

/** Stable edit target: item id, with an index fallback for id-less callers. */
function editKeyOf(item: AnnotationSummaryItem | undefined, index: number): string {
  return item?.id ?? `index:${index}`
}

/**
 * Qoder-style summary with a placement-aware hover list.
 *
 * The hover panel is portaled to <body>: the transcript wraps messages in
 * `contain: layout` surfaces, which become the containing block for
 * `position: fixed` descendants — a fixed panel inside them lands off-screen.
 * Open/close is React state; the pointer may sit on either the summary or the
 * portaled panel, so leaving one schedules a delayed close that entering the
 * other cancels. Comment editing happens inline in the list — the panel stays
 * put and auto-close is suppressed while an edit is open.
 */
export function AnnotationSummary({
  count,
  items,
  onRemoveAll,
  onItemSelect,
  onItemRemove,
  onItemEdit,
}: AnnotationSummaryProps): ReactNode {
  useLocale()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const popRef = useRef<HTMLDivElement | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null)
  const editInputRef = useRef<HTMLTextAreaElement | null>(null)
  /** Set while keyboard focus is being restored after a deliberate close. */
  const focusGuardRef = useRef(false)
  /** Set by keyboard open; the effect focuses the panel once it is mounted. */
  const enterPanelRef = useRef(false)
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  const place = useCallback(() => {
    const root = rootRef.current
    const pop = popRef.current
    if (!root || !pop) return
    const anchor = root.getBoundingClientRect()
    const panel = { width: pop.offsetWidth || 300, height: pop.offsetHeight || 220 }
    // gap 0: the facing transparent pad is the hover bridge (no dead strip).
    // 优先放摘要上方；只有上方确实放不下、且下方更宽裕时才翻下去。
    const { top, left, side } = placePopover(anchor, panel, 'top', 0)
    pop.style.top = `${top}px`
    pop.style.left = `${left}px`
    // Facing pad overlaps the summary so pointerleave does not fire in transit.
    pop.style.paddingTop = side === 'bottom' ? '12px' : '12px'
    pop.style.paddingBottom = side === 'top' ? '12px' : '12px'
    pop.dataset.side = side
    pop.style.opacity = '1'
  }, [])

  const cancelClose = useCallback(() => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const openPop = useCallback(() => {
    cancelClose()
    setOpen(true)
  }, [cancelClose])

  const closePop = useCallback(() => {
    cancelClose()
    setOpen(false)
  }, [cancelClose])

  /** Keyboard-focusable controls in the open panel, in DOM order. */
  const focusables = useCallback((): HTMLElement[] => {
    const pop = popRef.current
    if (!pop) return []
    return Array.from(
      pop.querySelectorAll<HTMLElement>('button, textarea, [href], [tabindex]:not([tabindex="-1"])'),
    ).filter((el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0)
  }, [])

  const focusPanel = useCallback(
    (edge: 'first' | 'last' = 'first') => {
      const list = focusables()
      const target = edge === 'first' ? list[0] : list[list.length - 1]
      target?.focus({ preventScroll: true })
    },
    [focusables],
  )

  /** Close the panel and put focus back on the summary without re-opening it. */
  const closeAndRestoreFocus = useCallback(() => {
    focusGuardRef.current = true
    closePop()
    rootRef.current?.focus({ preventScroll: true })
    window.setTimeout(() => {
      focusGuardRef.current = false
    }, 0)
  }, [closePop])

  const openAndEnterPanel = useCallback(() => {
    enterPanelRef.current = true
    openPop()
  }, [openPop])

  const scheduleClose = useCallback(() => {
    cancelClose()
    // An open inline edit is a committed interaction: never auto-close it.
    if (editing !== null) return
    closeTimerRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY)
  }, [cancelClose, editing])

  /** Touch pointers emit pointerleave on lift; only hover pointers auto-close. */
  const onPointerLeave = useCallback(
    (event?: ReactPointerEvent<HTMLElement>) => {
      if (event?.pointerType === 'touch') return
      scheduleClose()
    },
    [scheduleClose],
  )

  // A touch tap opens the panel; a second tap elsewhere closes it.
  const onSummaryPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'touch') return
      const target = event.target
      if (target instanceof Element && target.closest('button, textarea') !== null) return
      openPop()
    },
    [openPop],
  )

  // Clicking outside the summary/panel dismisses it on every pointer type.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (rootRef.current?.contains(target) || popRef.current?.contains(target)) return
      if (editing !== null) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open, editing])

  /** True when the last seen pointer sits on the summary or the panel. */
  const pointerInsideCluster = useCallback((): boolean => {
    const point = lastPointerRef.current
    if (!point) return true
    for (const el of [rootRef.current, popRef.current]) {
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) {
        return true
      }
    }
    return false
  }, [])

  // Place after open so measurement sees the real panel; re-place when the
  // list changes height (edit mode grows the item).
  useLayoutEffect(() => {
    if (!open) return
    place()
    // Second pass after layout settles (font swap / clamp reflow can shift height).
    const frame = window.requestAnimationFrame(() => place())
    return () => window.cancelAnimationFrame(frame)
  }, [open, place, items, editing])

  // Keyboard opened the panel: move focus to its first control once it exists.
  useLayoutEffect(() => {
    if (!open || !enterPanelRef.current) return
    enterPanelRef.current = false
    focusPanel('first')
  }, [open, focusPanel])

  // Track the pointer so viewport changes can tell "still hovering" from "gone".
  useEffect(() => {
    if (!open) return
    const track = (event: PointerEvent): void => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY }
    }
    window.addEventListener('pointermove', track, true)
    return () => window.removeEventListener('pointermove', track, true)
  }, [open])

  // Re-place on viewport / scroll changes: the anchor moves, the panel follows.
  // A reflow can fire pointerleave while the pointer is still on the cluster,
  // so the delayed close covers it; once things settle, close only when the
  // pointer really is outside (and no edit is in progress).
  useEffect(() => {
    if (!open) return
    let frame = 0
    const onViewportChange = (): void => {
      if (frame !== 0) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        place()
        if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
        settleTimerRef.current = window.setTimeout(() => {
          settleTimerRef.current = null
          if (editing === null && !pointerInsideCluster()) setOpen(false)
        }, SETTLE_DELAY)
      })
    }
    window.addEventListener('resize', onViewportChange)
    document.addEventListener('scroll', onViewportChange, true)
    return () => {
      window.removeEventListener('resize', onViewportChange)
      document.removeEventListener('scroll', onViewportChange, true)
      if (frame !== 0) window.cancelAnimationFrame(frame)
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    }
  }, [open, place, pointerInsideCluster, editing])

  // Focus the comment box when an item switches into edit mode.
  useEffect(() => {
    if (editing === null) return
    const focus = window.setTimeout(() => editInputRef.current?.focus(), 0)
    return () => window.clearTimeout(focus)
  }, [editing])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current)
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current)
    }
  }, [])

  const onPointerEnter = useCallback(() => {
    openPop()
  }, [openPop])

  const onBlur = useCallback(
    (e: { relatedTarget: Node | null }) => {
      const next = e.relatedTarget
      if (next instanceof Node) {
        if (rootRef.current?.contains(next)) return
        if (popRef.current?.contains(next)) return
      }
      closePop()
    },
    [closePop],
  )

  /** Keyboard focus opens the panel; mouse/touch focus does not. */
  const onSummaryFocus = useCallback(() => {
    if (focusGuardRef.current) return
    if (rootRef.current?.matches(':focus-visible')) openPop()
  }, [openPop])

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        if (editing !== null) setEditing(null)
        else closeAndRestoreFocus()
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        // Let the remove-all button handle its own activation.
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        if (open) closePop()
        else openAndEnterPanel()
        return
      }
      if (e.key === 'ArrowDown' && e.target === e.currentTarget) {
        e.preventDefault()
        if (open) focusPanel('first')
        else openAndEnterPanel()
        return
      }
      if (e.key === 'Tab' && open && !e.shiftKey && e.target === e.currentTarget) {
        e.preventDefault()
        focusPanel('first')
      }
    },
    [closeAndRestoreFocus, closePop, editing, focusPanel, open, openAndEnterPanel],
  )

  const onPanelKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      // The panel is a React portal child of the summary, so its events would
      // otherwise bubble to the summary's keydown and fight this handler.
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        if (editing !== null) setEditing(null)
        else closeAndRestoreFocus()
        return
      }
      if (e.key === 'Tab' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.stopPropagation()
      }
      const list = focusables()
      if (list.length === 0) return
      const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
      const index = active === null ? -1 : list.indexOf(active)
      if (e.key === 'Tab') {
        if (list.length === 1) {
          e.preventDefault()
          list[0].focus()
        } else if (!e.shiftKey && index === list.length - 1) {
          e.preventDefault()
          list[0].focus()
        } else if (e.shiftKey && index <= 0) {
          e.preventDefault()
          list[list.length - 1].focus()
        }
        return
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      // Arrow keys belong to the comment editor while it has focus.
      if (e.target instanceof HTMLTextAreaElement) return
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      const next = (index + step + list.length) % list.length
      list[next]?.focus({ preventScroll: true })
    },
    [closeAndRestoreFocus, editing, focusables],
  )

  const startEdit = useCallback((index: number) => {
    const item = items[index]
    if (!item) return
    setEditing(editKeyOf(item, index))
    setEditDraft(item.comment ?? '')
  }, [items])

  const commitEdit = useCallback(() => {
    if (editing === null) return
    const index = items.findIndex((item, i) => editKeyOf(item, i) === editing)
    const item = items[index]
    if (item) onItemEdit?.(index, item, editDraft)
    setEditing(null)
  }, [editing, items, editDraft, onItemEdit])

  const panel = open ? (
    <div
      ref={popRef}
      id={panelId}
      className={`${styles.summaryHover} ${styles.summaryHoverOpen}`}
      role="dialog"
      aria-label={t('summary.dialogAria', { count })}
      onPointerEnter={openPop}
      onPointerLeave={onPointerLeave}
      onKeyDown={onPanelKeyDown}
    >
      <div className={cx(A.col, styles.summaryHoverInner)}>
        <div className={cx(A.col, styles.summaryList)}>
          {items.map((item, i) => {
            const itemKey = editKeyOf(item, i)
            const isEditing = editing === itemKey
            return (
              <div key={item.id ?? `${i}`} className={styles.summaryItem}>
                <div className={cx(A.row, styles.summaryItemHead)}>
                  <div
                    className={cx(A.keep, A.gridMid, styles.summaryItemBadge)}
                    aria-hidden="true"
                  >
                    {String(i + 1)}
                  </div>
                  <div className={styles.summaryItemLabel}>{t('common.selectedText')}</div>
                  {!isEditing && (onItemRemove || onItemEdit) ? (
                    <div className={cx(A.row, styles.summaryItemActions)}>
                      {onItemEdit ? (
                        <button
                          type="button"
                          className={cx(A.plain, A.gridMid, styles.summaryItemAction)}
                          aria-label={t('summary.edit', { index: i + 1 })}
                          onClick={() => startEdit(i)}
                        >
                          <LucideIcon name="pencil" />
                        </button>
                      ) : null}
                      {onItemRemove ? (
                        <button
                          type="button"
                          className={cx(A.plain, A.gridMid, styles.summaryItemAction)}
                          aria-label={t('summary.remove', { index: i + 1 })}
                          onClick={() => onItemRemove(i, item)}
                        >
                          <LucideIcon name="trash-2" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {isEditing ? (
                  <div className={styles.summaryItemMain}>
                    <div className={styles.annEditText}>{item.text}</div>
                    <div className={styles.summaryItemLabel}>{t('summary.userComment')}</div>
                    <textarea
                      ref={editInputRef}
                      className={cx(A.box, styles.annEditInput)}
                      placeholder={t('common.commentPlaceholder')}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          e.preventDefault()
                          e.stopPropagation()
                          setEditing(null)
                          return
                        }
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          e.preventDefault()
                          commitEdit()
                        }
                      }}
                    />
                    <div className={cx(A.row, styles.annEditActions)}>
                      <button
                        type="button"
                        className={cx(A.plain, styles.annEditCancel)}
                        onClick={() => setEditing(null)}
                      >
                        {t('common.cancel')}
                      </button>
                      <button type="button" className={styles.annEditSave} onClick={commitEdit}>
                        {t('common.save')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.summaryItemMain}>
                    <button
                      type="button"
                      className={cx(A.plain, styles.summaryItemButton)}
                      onClick={() => {
                        onItemSelect?.(i, item)
                        closePop()
                      }}
                    >
                      <div className={styles.summaryItemText}>{item.title}</div>
                      <div className={styles.summaryItemLabel}>{t('summary.userComment')}</div>
                      <div
                        className={
                          item.comment
                            ? styles.summaryItemText
                            : `${styles.summaryItemText} ${styles.summaryItemTextEmpty}`
                        }
                      >
                        {item.comment || t('summary.noComment')}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  ) : null

  return (
    <div
      ref={rootRef}
      className={cx(A.row, styles.summary)}
      tabIndex={0}
      data-selection-annotation-summary="true"
      aria-label={t('summary.aria', { count })}
      aria-expanded={open}
      aria-haspopup="dialog"
      aria-controls={open ? panelId : undefined}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onPointerUp={onSummaryPointerUp}
      onFocus={onSummaryFocus}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <div className={cx(A.keep, A.gridMid, styles.summaryIcon)} aria-hidden="true">
        {String(count)}
      </div>
      <div className={cx(A.grow, styles.summaryBody)}>
        <div className={styles.summaryTitle}>{t('summary.title', { count })}</div>
        <div className={cx(styles.summaryHint, styles.summaryHintPointer)}>
          {t('summary.hint')}
        </div>
        <div className={cx(styles.summaryHint, styles.summaryHintTouch)}>
          {t('summary.hintTouch')}
        </div>
      </div>
      {onRemoveAll ? (
        <button
          type="button"
          className={cx(A.plain, A.gridMid, styles.cardClose)}
          aria-label={t('summary.removeAll')}
          onClick={onRemoveAll}
        >
          <LucideIcon name="x" size={13} />
        </button>
      ) : null}
      {panel !== null && typeof document !== 'undefined' ? createPortal(panel, document.body) : null}
    </div>
  )
}
