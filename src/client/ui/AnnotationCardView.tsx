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
import { jsx, jsxs } from 'react/jsx-runtime'
import { placePopover } from '../dom/popoverPlacement.ts'
import { styles } from '../styles.ts'
import { LucideIcon } from './icons.tsx'
import { t } from '../i18n.ts'

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
  return jsxs('div', {
    className: composer ? styles.card : styles.tCard,
    role: 'group',
    'aria-label': index ? t('card.ariaIndexed', { index }) : t('card.ariaPlain'),
    children: [
      jsx('div', {
        className: composer ? styles.cardIcon : styles.tCardIcon,
        'aria-hidden': true,
        children: index ? String(index) : 'AI',
      }),
      jsxs('div', {
        className: composer ? styles.cardBody : styles.tCardBody,
        children: [
          jsx('div', {
            className: composer ? styles.cardTitle : styles.tCardTitle,
            title: text,
            children: title,
          }),
          jsx('div', {
            className: composer ? styles.cardSubtitle : styles.tCardSubtitle,
            // Transcript cards clamp the comment; keep the full text reachable
            // as a native tooltip, and let CSS tell a real comment apart from
            // the "no comment" placeholder.
            ...(comment ? { title: comment, 'data-dsq-has-comment': 'true' } : {}),
            children: subtitle,
          }),
        ],
      }),
      composer && onEditComment
        ? jsx('button', {
            type: 'button',
            className: styles.cardAction,
            'aria-label': t('card.editComment'),
            onClick: onEditComment,
            children: '✎',
          })
        : null,
      composer && onRemove
        ? jsx('button', {
            type: 'button',
            className: styles.cardClose,
            'aria-label': t('card.remove'),
            onClick: onRemove,
            children: '×',
          })
        : null,
    ],
  })
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
  readonly hint?: string
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
  hint = t('summary.hint'),
}: AnnotationSummaryProps): ReactNode {
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
    const { top, left, side } = placePopover(anchor, panel, 'bottom', 0)
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

  const panel = open
    ? jsx('div', {
        ref: popRef,
        className: `${styles.summaryHover} ${styles.summaryHoverOpen}`,
        role: 'dialog',
        'aria-label': t('summary.dialogAria', { count }),
        onPointerEnter: openPop,
        onPointerLeave: onPointerLeave,
        children: jsx('div', {
          className: styles.summaryHoverInner,
          children: items.map((item, i) => {
            const isEditing = editing === i
            return jsxs(
              'div',
              {
                className: styles.summaryItem,
                children: [
                  jsxs('div', {
                    className: styles.summaryItemHead,
                    children: [
                      jsx('div', {
                        className: styles.summaryItemBadge,
                        'aria-hidden': true,
                        children: String(i + 1),
                      }),
                      jsx('div', {
                        className: styles.summaryItemLabel,
                        children: t('common.selectedText'),
                      }),
                      !isEditing && (onItemRemove || onItemEdit)
                        ? jsxs('div', {
                            className: styles.summaryItemActions,
                            children: [
                              onItemEdit
                                ? jsx('button', {
                                    type: 'button',
                                    className: styles.summaryItemAction,
                                    'aria-label': t('summary.edit', { index: i + 1 }),
                                    onClick: () => startEdit(i),
                                    children: jsx(LucideIcon, { name: 'pencil' }),
                                  })
                                : null,
                              onItemRemove
                                ? jsx('button', {
                                    type: 'button',
                                    className: styles.summaryItemAction,
                                    'aria-label': t('summary.remove', { index: i + 1 }),
                                    onClick: () => onItemRemove(i, item),
                                    children: jsx(LucideIcon, { name: 'trash-2' }),
                                  })
                                : null,
                            ],
                          })
                        : null,
                    ],
                  }),
                  isEditing
                    ? jsxs('div', {
                        className: styles.summaryItemMain,
                        children: [
                          jsx('div', {
                            className: styles.annEditText,
                            children: item.text,
                          }),
                          jsx('div', {
                            className: styles.summaryItemLabel,
                            children: t('summary.userComment'),
                          }),
                          jsx('textarea', {
                            ref: editInputRef,
                            className: styles.annEditInput,
                            placeholder: t('common.commentPlaceholder'),
                            value: editDraft,
                            onChange: (e: { target: { value: string } }) => setEditDraft(e.target.value),
                            onKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                              if (e.key === 'Escape') {
                                e.preventDefault()
                                setEditing(null)
                                return
                              }
                              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault()
                                commitEdit()
                              }
                            },
                          }),
                          jsxs('div', {
                            className: styles.annEditActions,
                            children: [
                              jsx('button', {
                                type: 'button',
                                className: styles.annEditCancel,
                                onClick: () => setEditing(null),
                                children: t('common.cancel'),
                              }),
                              jsx('button', {
                                type: 'button',
                                className: styles.annEditSave,
                                onClick: commitEdit,
                                children: t('common.save'),
                              }),
                            ],
                          }),
                        ],
                      })
                    : jsx('div', {
                        className: styles.summaryItemMain,
                        children: jsxs('button', {
                          type: 'button',
                          className: styles.summaryItemButton,
                          onClick: () => {
                            onItemSelect?.(i, item)
                            closePop()
                          },
                          children: [
                            jsx('div', {
                              className: styles.summaryItemText,
                              children: item.title,
                            }),
                            jsx('div', {
                              className: styles.summaryItemLabel,
                              children: t('summary.userComment'),
                            }),
                            jsx('div', {
                              className: item.comment
                                ? styles.summaryItemText
                                : `${styles.summaryItemText} ${styles.summaryItemTextEmpty}`,
                              children: item.comment || t('summary.noComment'),
                            }),
                          ],
                        }),
                      }),
                ],
              },
              item.id ?? `${i}`,
            )
          }),
        }),
      })
    : null

  return jsxs('div', {
    ref: rootRef,
    className: styles.summary,
    tabIndex: 0,
    'data-selection-annotation-summary': 'true',
    'aria-label': t('summary.aria', { count }),
    'aria-expanded': open,
    onPointerEnter,
    onPointerLeave,
    onFocus: onPointerEnter,
    onBlur,
    onKeyDown,
    children: [
      jsx('div', {
        className: styles.summaryIcon,
        'aria-hidden': true,
        children: String(count),
      }),
      jsxs('div', {
        className: styles.summaryBody,
        children: [
          jsx('div', {
            className: styles.summaryTitle,
            children: t('summary.title', { count }),
          }),
          jsx('div', {
            className: styles.summaryHint,
            children: hint,
          }),
        ],
      }),
      onRemoveAll
        ? jsx('button', {
            type: 'button',
            className: styles.cardClose,
            'aria-label': t('summary.removeAll'),
            onClick: onRemoveAll,
            children: jsx(LucideIcon, { name: 'x', size: 13 }),
          })
        : null,
      panel !== null && typeof document !== 'undefined'
        ? createPortal(panel, document.body)
        : null,
    ],
  })
}
