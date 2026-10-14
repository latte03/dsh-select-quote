import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { jsx, jsxs } from 'react/jsx-runtime'
import { createPortal } from 'react-dom'
import {
  clearNativeSelection,
  copyText,
  readSelectionSnapshot,
  type SelectionSnapshot,
} from './dom/selection.ts'
import { focusComposer } from './dom/composer-host.ts'
import { t } from './i18n.ts'
import { placePopover } from './dom/popoverPlacement.ts'
import { setRuntimeSession } from './runtime.ts'
import { getAnnotations, saveAnnotation } from './state/annotation-store.ts'
import { ensureToolbarStyles, styles } from './styles.ts'
import { LucideIcon } from './ui/icons.tsx'

export interface SelectionToolbarProps {
  sessionId?: string
}

type Phase = 'idle' | 'comment'

/** Cap for the auto-growing comment box; beyond this it scrolls internally. */
const COMMENT_MAX_HEIGHT = 220

export function SelectionToolbar({ sessionId }: SelectionToolbarProps): ReactNode {
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const commentWrapRef = useRef<HTMLDivElement | null>(null)
  const commentRef = useRef<HTMLTextAreaElement | null>(null)
  const [active, setActive] = useState<SelectionSnapshot | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const activeRef = useRef<SelectionSnapshot | null>(null)
  activeRef.current = active

  useEffect(() => {
    ensureToolbarStyles()
    if (sessionId) setRuntimeSession(sessionId)
  }, [sessionId])

  const hide = useCallback(() => {
    setActive(null)
    setPhase('idle')
    setComment('')
    setStatus(null)
  }, [])

  const refresh = useCallback(() => {
    const next = readSelectionSnapshot(toolbarRef.current)
    if (!next) {
      // Keep an open comment popover; only drop idle toolbar when selection dies.
      if (phaseRef.current === 'idle') setActive(null)
      return
    }
    setActive((prev) => {
      // New text while commenting → drop back to idle toolbar for the new range.
      if (phaseRef.current === 'comment' && prev && prev.text !== next.text) {
        setPhase('idle')
        setComment('')
      }
      if (prev && prev.text === next.text && prev.left === next.left && prev.top === next.top) {
        return prev
      }
      return next
    })
  }, [])

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    const schedule = () => window.setTimeout(refresh, 0)
    // The toolbar waits for the drag to end: selectionchange fires continuously
    // mid-drag, so it must not raise the toolbar — pointerup does.
    let dragging = false

    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      const inToolbar = toolbarRef.current?.contains(target) === true
      const inComment = commentWrapRef.current?.contains(target) === true
      if (inToolbar || inComment) return
      // Any outside press may start a new selection drag.
      dragging = true

      // Outside click: cancel comment mode entirely so the next selection
      // shows the idle toolbar again.
      if (phaseRef.current === 'comment') {
        hide()
        return
      }

      const selection = window.getSelection()
      if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
        schedule()
        return
      }
      hide()
    }

    const onPointerUp = () => {
      dragging = false
      schedule()
    }

    const onSelectionChange = () => {
      if (dragging) return
      schedule()
    }

    // Scroll inside our own popover must not count as a page scroll: a long
    // comment scrolls its textarea, and closing here would throw away what the
    // user just typed. The capture listener fires for descendants too, so the
    // origin has to be checked instead of relying on bubbling.
    const onScroll = (event: Event) => {
      const target = event.target
      if (
        target instanceof Node &&
        (toolbarRef.current?.contains(target) === true ||
          commentWrapRef.current?.contains(target) === true)
      ) {
        return
      }
      hide()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('keyup', schedule, true)
    document.addEventListener('selectionchange', onSelectionChange)
    window.addEventListener('resize', hide)
    document.addEventListener('scroll', onScroll, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('keyup', schedule, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      window.removeEventListener('resize', hide)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [hide, refresh])

  // Flip the comment popover when the preferred side lacks room, and center it
  // on the selection (the CSS transform shifts it back by half its width).
  const placeCommentPop = useCallback(() => {
    const toolbar = toolbarRef.current
    const pop = commentWrapRef.current
    if (!toolbar || !pop) return
    const anchor = toolbar.getBoundingClientRect()
    pop.style.display = 'flex'
    pop.style.visibility = 'hidden'
    const panel = { width: pop.offsetWidth || 320, height: pop.offsetHeight || 180 }
    pop.style.visibility = ''
    const { top } = placePopover(anchor, panel, 'bottom')
    const half = panel.width / 2 + 8
    const center = Math.min(
      Math.max(anchor.left + anchor.width / 2, half),
      Math.max(half, window.innerWidth - half),
    )
    pop.style.top = `${top}px`
    pop.style.left = `${center}px`
  }, [])

  useEffect(() => {
    if (phase === 'comment') {
      placeCommentPop()
      commentRef.current?.focus()
    }
  }, [phase, placeCommentPop])

  // Grow the comment box with its content (up to a cap) instead of letting it
  // scroll internally: a fixed 64px box starts scrolling after a few wrapped
  // lines, which reads as a character limit. Re-place the popover afterwards so
  // a taller box still flips and clamps correctly.
  useEffect(() => {
    if (phase !== 'comment') return
    const area = commentRef.current
    if (!area) return
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight, COMMENT_MAX_HEIGHT)}px`
    placeCommentPop()
  }, [phase, comment, placeCommentPop])

  const handleToolbarPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  const handleCopy = useCallback(async () => {
    const snapshot = activeRef.current
    if (!snapshot) return
    try {
      await copyText(snapshot.text)
      clearNativeSelection()
      hide()
    } catch {
      setStatus(t('toolbar.copyFailed'))
    }
  }, [hide])

  const openComment = useCallback(() => {
    if (!activeRef.current) return
    setPhase('comment')
    setComment('')
    setStatus(null)
  }, [])

  /** Quick-add without opening the comment step (double-tap / “Skip comment”). */
  const commitAnnotation = useCallback(
    (body: string | undefined) => {
      const snapshot = activeRef.current
      if (!snapshot) {
        hide()
        return
      }
      saveAnnotation(undefined, {
        text: snapshot.text,
        ...(body && body.trim() ? { comment: body.trim() } : {}),
        sources: snapshot.source
          ? [
              {
                text: snapshot.text,
                messageId: snapshot.source.messageId,
                messageKind: snapshot.source.messageKind,
                startOffset: snapshot.source.startOffset,
                endOffset: snapshot.source.endOffset,
              },
            ]
          : undefined,
      })
      const count = getAnnotations().length
      clearNativeSelection()
      hide()
      setStatus(null)
      window.setTimeout(focusComposer, 16)
      // Transient confirmation near the composer is owned by AnnotationPanel.
      void count
    },
    [hide],
  )

  if (!active) return null

  const toolbarStyle: CSSProperties = { left: active.left, top: active.top }

  return createPortal(
    jsxs(Fragment, {
      children: [
        jsx('div', {
          ref: toolbarRef,
          className: styles.toolbar,
          style: toolbarStyle,
          role: 'toolbar',
          'aria-label': t('toolbar.aria'),
          'data-dsq-toolbar': 'true',
          onPointerDown: handleToolbarPointerDown,
          children:
            phase === 'comment'
              ? jsx('div', {
                  style: { display: 'inline-flex', alignItems: 'center', gap: 2 },
                  children: jsx('span', {
                    style: { padding: '0 8px', fontSize: 13, opacity: 0.8 },
                    children: t('toolbar.commentHint'),
                  }),
                })
              : jsxs('div', {
                  style: { display: 'inline-flex', alignItems: 'center', gap: 2 },
                  children: [
                    jsx('button', {
                      type: 'button',
                      className: styles.button,
                      onClick: () => void handleCopy(),
                      children: [
                        jsx(LucideIcon, { name: 'copy', size: 14 }),
                        t('toolbar.copy'),
                      ],
                    }),
                    jsx('span', { className: styles.divider, 'aria-hidden': true }),
                    jsx('button', {
                      type: 'button',
                      className: styles.button,
                      onClick: openComment,
                      children: [
                        jsx(LucideIcon, { name: 'plus', size: 14 }),
                        t('toolbar.addToTask'),
                      ],
                    }),
                  ],
                }),
        }),
        phase === 'comment'
          ? jsxs('div', {
              ref: commentWrapRef,
              className: styles.commentPop,
              style: undefined,
              role: 'dialog',
              'aria-label': t('toolbar.commentDialogAria'),
              onPointerDown: handleToolbarPointerDown,
              children: [
                jsx('textarea', {
                  ref: commentRef,
                  className: styles.commentInput,
                  placeholder: t('common.commentPlaceholder'),
                  value: comment,
                  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value),
                  onKeyDown: (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      hide()
                      return
                    }
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault()
                      commitAnnotation(comment)
                    }
                  },
                }),
                jsxs('div', {
                  className: styles.commentActions,
                  children: [
                    jsx('button', {
                      type: 'button',
                      className: styles.button,
                      onClick: () => commitAnnotation(undefined),
                      children: t('toolbar.skipComment'),
                    }),
                    jsx('button', {
                      type: 'button',
                      className: styles.button,
                      disabled: !comment.trim(),
                      onClick: () => commitAnnotation(comment),
                      children: t('toolbar.addComment'),
                    }),
                  ],
                }),
              ],
            })
          : null,
        status
          ? jsx('div', {
              className: styles.status,
              style: toolbarStyle,
              role: 'status',
              children: status,
            })
          : null,
      ],
    }),
    document.body,
  )
}
