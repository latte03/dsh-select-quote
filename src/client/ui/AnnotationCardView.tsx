import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { placePopover } from '../dom/popoverPlacement.ts'
import { A, cx, styles } from '../styles.ts'
import { LucideIcon } from './icons.tsx'
import { t } from '../i18n.ts'
import { useLocale } from '../useLocale.ts'

export interface AnnotationCardViewProps {
  readonly title: string
  readonly text: string
  readonly comment?: string
  readonly variant: 'composer' | 'transcript'
  readonly index?: number
  readonly onRemove?: () => void
  readonly onEditComment?: () => void
}

export function AnnotationCardView({
  title,
  text,
  comment,
  variant,
  index,
  onRemove,
  onEditComment,
}: AnnotationCardViewProps): ReactNode {
  useLocale()
  const composer = variant === 'composer'
  // Composer cards summarise a pending selection, so the comment gets a label
  // ("Comment · …"). Transcript cards already show the selected text as the
  // card title, so the line below it is the comment itself — no label needed.
  // Their no-comment state says so instead of repeating the title.
  const subtitle = comment
    ? composer
      ? t('card.commentSubtitle', { comment })
      : comment
    : composer
      ? t('common.selectedText')
      : t('summary.noComment')
  return (
    <div
      className={cx(A.box, A.row, styles.card, !composer && styles.tCard)}
      role="group"
      aria-label={index ? t('card.ariaIndexed', { index }) : t('card.ariaPlain')}
    >
      <div
        className={cx(A.keep, A.gridMid, styles.cardIcon, !composer && styles.tCardIcon)}
        aria-hidden="true"
      >
        {index ? String(index) : 'AI'}
      </div>
      <div className={cx(A.grow, A.col, styles.cardBody)}>
        <div className={cx(A.ell, styles.cardTitle)} title={text}>
          {title}
        </div>
        {/* Transcript cards clamp the comment; keep the full text reachable
            as a native tooltip, and let CSS tell a real comment apart from
            the "no comment" placeholder. */}
        <div
          className={cx(A.ell, styles.cardSubtitle)}
          {...(comment ? { title: comment, 'data-dsq-has-comment': 'true' } : {})}
        >
          {subtitle}
        </div>
      </div>
      {composer && onEditComment ? (
        <button
          type="button"
          className={cx(A.plain, A.gridMid, styles.cardAction)}
          aria-label={t('card.editComment')}
          onClick={onEditComment}
        >
          ✎
        </button>
      ) : null}
      {composer && onRemove ? (
        <button
          type="button"
          className={cx(A.plain, A.gridMid, styles.cardClose)}
          aria-label={t('card.remove')}
          onClick={onRemove}
        >
          ×
        </button>
      ) : null}
    </div>
  )
}

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
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
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

  const scheduleClose = useCallback(() => {
    cancelClose()
    // An open inline edit is a committed interaction: never auto-close it.
    if (editing !== null) return
    closeTimerRef.current = window.setTimeout(() => setOpen(false), CLOSE_DELAY)
  }, [cancelClose, editing])

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

  const onPointerLeave = useCallback(() => {
    scheduleClose()
  }, [scheduleClose])

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

  const onKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLElement>) => {
      if (e.key === 'Escape') {
        if (editing !== null) setEditing(null)
        else closePop()
      }
    },
    [closePop, editing],
  )

  const startEdit = useCallback((index: number) => {
    setEditing(index)
    setEditDraft(items[index]?.comment ?? '')
  }, [items])

  const commitEdit = useCallback(() => {
    if (editing === null) return
    const item = items[editing]
    if (item) onItemEdit?.(editing, item, editDraft)
    setEditing(null)
  }, [editing, items, editDraft, onItemEdit])

  const panel = open ? (
    <div
      ref={popRef}
      className={`${styles.summaryHover} ${styles.summaryHoverOpen}`}
      role="dialog"
      aria-label={t('summary.dialogAria', { count })}
      onPointerEnter={openPop}
      onPointerLeave={onPointerLeave}
    >
      <div className={cx(A.col, styles.summaryHoverInner)}>
        <div className={cx(A.col, styles.summaryList)}>
          {items.map((item, i) => {
            const isEditing = editing === i
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
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={onPointerEnter}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <div className={cx(A.keep, A.gridMid, styles.summaryIcon)} aria-hidden="true">
        {String(count)}
      </div>
      <div className={cx(A.grow, styles.summaryBody)}>
        <div className={styles.summaryTitle}>{t('summary.title', { count })}</div>
        <div className={styles.summaryHint}>{t('summary.hint')}</div>
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
