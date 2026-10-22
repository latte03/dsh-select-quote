import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import {
  clearNativeSelection,
  copyText,
  readSelectionSnapshot,
  type SelectionSnapshot,
} from './dom/selection.ts'
import { focusComposer } from './dom/composer-host.ts'
import { linkTarget } from './dom/selection-url.ts'
import { t } from './i18n.ts'
import { useLocale } from './useLocale.ts'
import {
  bindAnnotationSession,
  saveAnnotation,
  updateAnnotationComment,
} from './state/annotation-store.ts'
import { ensureToolbarStyles, A, cx, styles } from './styles.ts'
import { LucideIcon, type IconName } from './ui/icons.tsx'
import { useCoarsePointer, useVisualViewport } from './ui/touch.ts'

export interface SelectionToolbarProps {
  sessionId?: string
}

type Phase = 'idle' | 'comment'

/** Cap for the auto-growing comment box; beyond this it scrolls internally. */
const COMMENT_MAX_HEIGHT = 220

export function SelectionToolbar({ sessionId }: SelectionToolbarProps): ReactNode {
  useLocale()
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const commentWrapRef = useRef<HTMLDivElement | null>(null)
  const commentRef = useRef<HTMLTextAreaElement | null>(null)
  const [active, setActive] = useState<SelectionSnapshot | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const activeRef = useRef<SelectionSnapshot | null>(null)
  activeRef.current = active
  /** Annotation saved when the comment step opened; the box only edits it. */
  const pendingIdRef = useRef<string | null>(null)
  const touch = useCoarsePointer()
  const viewport = useVisualViewport(touch)

  useEffect(() => {
    ensureToolbarStyles()
    if (sessionId) bindAnnotationSession(sessionId)
  }, [sessionId])

  const hide = useCallback(() => {
    pendingIdRef.current = null
    setActive(null)
    setPhase('idle')
    setComment('')
    setStatus(null)
  }, [])

  /**
   * Keep what was typed when the comment popover goes away without an explicit
   * cancel. The annotation itself was saved when the step opened, so dropping
   * the text would also lose the only optional part of the interaction.
   */
  const flushComment = useCallback(() => {
    const id = pendingIdRef.current
    pendingIdRef.current = null
    if (!id) return
    const typed = commentRef.current?.value ?? ''
    if (typed.trim()) updateAnnotationComment(undefined, id, typed)
  }, [])

  /** Save the current selection without a comment; returns the store id. */
  const saveSelection = useCallback((): string | null => {
    const snapshot = activeRef.current
    if (!snapshot) return null
    return saveAnnotation(undefined, {
      text: snapshot.text,
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
    }).id
  }, [])

  const refresh = useCallback(() => {
    const next = readSelectionSnapshot(toolbarRef.current)
    if (!next) {
      // Keep an open comment popover; only drop idle toolbar when selection dies.
      if (phaseRef.current === 'idle') setActive(null)
      return
    }
    const current = activeRef.current
    if (phaseRef.current === 'comment' && current && current.text !== next.text) {
      // A new range replaces the comment step: keep the typed comment on the
      // old (already saved) annotation, then retarget the toolbar.
      flushComment()
      setPhase('idle')
      setComment('')
    }
    setActive((prev) =>
      prev &&
      prev.text === next.text &&
      prev.left === next.left &&
      prev.top === next.top &&
      prev.below === next.below &&
      prev.layer === next.layer
        ? prev
        : next,
    )
  }, [flushComment])

  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    // Scroll / selectionchange / keyup can land several times in one tick;
    // collapse them into a single re-read — each refresh measures the range,
    // and during a scroll there is no point paying for that twice.
    let scheduled = false
    const schedule = () => {
      if (scheduled) return
      scheduled = true
      window.setTimeout(() => {
        scheduled = false
        refresh()
      }, 0)
    }
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

      // Outside click ends the optional comment step, never the annotation:
      // it was saved the moment "add to task" was pressed. Keep what was typed
      // too — only an explicit skip / Escape discards the comment text.
      if (phaseRef.current === 'comment') {
        flushComment()
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
    // comment scrolls its textarea, and re-placing here would fight the user.
    // The capture listener fires for descendants too, so the origin has to be
    // checked instead of relying on bubbling.
    //
    // A page scroll follows the selection instead of dropping the toolbar: the
    // selection and its highlight survive scrolling, so hiding mid-annotation
    // read as "still selected, buttons gone". When the first line scrolls fully
    // out of view, readSelectionSnapshot returns null and refresh retracts the
    // idle toolbar (it reappears on the way back). An open comment popover is
    // never retracted by refresh, so scrolling away to re-read the question no
    // longer throws away what was typed.
    const onScroll = (event: Event) => {
      const target = event.target
      if (
        target instanceof Node &&
        (toolbarRef.current?.contains(target) === true ||
          commentWrapRef.current?.contains(target) === true)
      ) {
        return
      }
      schedule()
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('keyup', schedule, true)
    document.addEventListener('selectionchange', onSelectionChange)
    // A resize moves the selection's rect, so the toolbar must follow it rather
    // than vanish mid-annotation. Re-reading the live selection re-places it,
    // and drops it only when the selection itself is gone.
    window.addEventListener('resize', schedule)
    document.addEventListener('scroll', onScroll, true)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('keyup', schedule, true)
      document.removeEventListener('selectionchange', onSelectionChange)
      window.removeEventListener('resize', schedule)
      document.removeEventListener('scroll', onScroll, true)
    }
  }, [flushComment, hide, refresh])

  // Flip the comment popover when the preferred side lacks room, and center it
  // on the selection. Both the toolbar and this box live in the transcript
  // layer's content coordinates, so scrolling moves them together; only a
  // layout change needs a re-place. The visible bounds are the scroller's box,
  // not the window: the popover must not be clamped underneath the composer.
  const placeCommentPop = useCallback(() => {
    if (touch) return
    const snapshot = activeRef.current
    const layer = snapshot?.layer
    const toolbar = toolbarRef.current
    const pop = commentWrapRef.current
    if (!snapshot || !layer || !toolbar || !pop) return
    const bounds = layer.bounds()
    // The toolbar has already moved beside the popover when this re-runs (the
    // comment grew, the window resized). Rebuild its home rect from the stored
    // selection anchor instead of measuring where it currently sits.
    const toolbarW = toolbar.offsetWidth
    const toolbarH = toolbar.offsetHeight
    const home = layer.fromContent(snapshot.left, snapshot.top)
    const anchor = {
      left: home.left - toolbarW / 2,
      top: home.top - (snapshot.below ? 0 : toolbarH),
      width: toolbarW,
      height: toolbarH,
    }
    pop.style.display = 'flex'
    pop.style.visibility = 'hidden'
    const panel = { width: pop.offsetWidth || 320, height: pop.offsetHeight || 180 }
    pop.style.visibility = ''

    // Prefer below the selected text, not below the toolbar: the toolbar sits
    // only 12px above the first line, so anchoring here would cover the words
    // being commented on. When the selection is too low, go above the toolbar
    // instead — never over the selection.
    const gap = 8
    const margin = 8
    const belowTop = layer.fromContent(0, snapshot.selectionBottom).top + gap
    const aboveTop = anchor.top - panel.height - gap
    const top =
      belowTop <= bounds.bottom - margin - panel.height
        ? belowTop
        : aboveTop >= bounds.top + margin
          ? aboveTop
          : Math.max(
              bounds.top + margin,
              Math.min(belowTop, bounds.bottom - margin - panel.height),
            )

    const half = panel.width / 2 + 8
    const min = bounds.left + half
    const center = Math.min(
      Math.max(anchor.left + anchor.width / 2, min),
      Math.max(min, bounds.right - half),
    )
    const at = layer.toContent(center, top)
    pop.style.top = `${at.top}px`
    pop.style.left = `${at.left}px`

    // The "adding a comment" hint sits above the popover's top-left corner:
    // left edges aligned, 6px clear of the card's top edge. Flip below the
    // card only when the top of the scroller leaves no room.
    const sideGap = 6
    const popCenter = layer.fromContent(at.left, at.top)
    const popLeftView = popCenter.left - panel.width / 2
    const popTopView = top
    let leftView = popLeftView
    let topView = popTopView - sideGap - toolbarH
    if (topView < bounds.top + margin) topView = popTopView + panel.height + sideGap
    leftView = Math.max(bounds.left + margin, Math.min(leftView, bounds.right - margin - toolbarW))
    topView = Math.max(bounds.top + margin, Math.min(topView, bounds.bottom - margin - toolbarH))
    const toolbarAt = layer.toContent(leftView, topView)
    toolbar.style.left = `${toolbarAt.left}px`
    toolbar.style.top = `${toolbarAt.top}px`
  }, [touch])

  // Use layout effects: the box is measured and placed before the first paint,
  // so it never flashes at the host's origin. Scroll itself does not need a
  // re-place — content coordinates already follow the selection.
  useLayoutEffect(() => {
    if (phase === 'comment' && !touch) placeCommentPop()
  }, [active, phase, placeCommentPop, touch])

  // The composer summary card lives in the seat (z 7) and can reach over the
  // scroller area; the popover is clipped to the scroller at z 6, so the card
  // would paint over it. Lift the host only while the comment step is open.
  const layer = active?.layer
  useLayoutEffect(() => {
    if (!layer || touch) return
    layer.setAboveComposer(phase === 'comment')
    return () => layer.setAboveComposer(false)
  }, [layer, phase, touch])

  // Focus once when the box opens, not on every re-placement. On touch the
  // comment is optional, so the sheet waits for a tap instead of raising the
  // soft keyboard the moment it appears.
  useEffect(() => {
    if (phase === 'comment' && !touch) commentRef.current?.focus()
  }, [phase, touch])

  // The popover is anchored to the toolbar, so a window resize moves both.
  useEffect(() => {
    if (touch) return
    const onResize = (): void => placeCommentPop()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [placeCommentPop, touch])

  // Grow the comment box with its content (up to a cap) instead of letting it
  // scroll internally: a fixed 64px box starts scrolling after a few wrapped
  // lines, which reads as a character limit. Re-place the popover afterwards so
  // a taller box still flips and clamps correctly.
  useLayoutEffect(() => {
    if (phase !== 'comment') return
    const area = commentRef.current
    if (!area) return
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight, COMMENT_MAX_HEIGHT)}px`
    if (!touch) placeCommentPop()
  }, [phase, comment, placeCommentPop, touch])

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

  /**
   * "Add to task" is the commit: the quote is saved immediately, with or
   * without a comment. The popover only edits that saved entry, so dismissing
   * it (outside click, new selection) can never undo the annotation.
   */
  const openComment = useCallback(() => {
    if (!activeRef.current) return
    pendingIdRef.current = saveSelection()
    setPhase('comment')
    setComment('')
    setStatus(null)
  }, [saveSelection])

  /**
   * Hand the selected link to the system browser.
   *
   * `window.open` deliberately bypasses the host's in-app sidebar browser: the
   * desktop shell's window-open handler sends http(s) straight to
   * `shell.openExternal`, so the page never renders inside the client (loading
   * arbitrary URLs there is what wedges it). Only http(s) selections get this
   * button — every other scheme is refused by that handler.
   */
  const handleOpenLink = useCallback(() => {
    const snapshot = activeRef.current
    const url = snapshot ? linkTarget(snapshot.text, snapshot.anchorHref) : null
    if (!url) return
    window.open(url, '_blank', 'noopener,noreferrer')
    clearNativeSelection()
    hide()
  }, [hide])

  /** Close the optional comment step; the annotation stays saved either way. */
  const finishComment = useCallback(
    (keepComment: boolean) => {
      if (keepComment) flushComment()
      else pendingIdRef.current = null
      clearNativeSelection()
      hide()
      // On touch the sheet already covered the reader's place; opening the
      // composer keyboard on top of that is a second, unwanted jump.
      if (!touch) window.setTimeout(focusComposer, 16)
    },
    [flushComment, hide, touch],
  )

  /** Dismiss the sheet without discarding what was typed (desktop outside-click). */
  const closeCommentSheet = useCallback(() => {
    flushComment()
    hide()
  }, [flushComment, hide])

  if (!active) return null

  const toolbarStyle: CSSProperties = { left: active.left, top: active.top }
  const link = linkTarget(active.text, active.anchorHref)
  const actions: Array<{
    key: string
    icon: IconName
    label: string
    onClick: () => void
  }> = [
    ...(link
      ? [
          {
            key: 'open',
            icon: 'external-link' as const,
            label: t('toolbar.openLink'),
            onClick: handleOpenLink,
          },
        ]
      : []),
    { key: 'copy', icon: 'copy', label: t('toolbar.copy'), onClick: () => void handleCopy() },
    { key: 'add', icon: 'plus', label: t('toolbar.addToTask'), onClick: openComment },
  ]

  const actionRow = (stacked: boolean): ReactNode =>
    actions.map((action, index) => (
      <Fragment key={action.key}>
        {!stacked && index > 0 ? <span className={styles.divider} aria-hidden="true" /> : null}
        <button
          type="button"
          className={cx(
            A.plain,
            stacked ? A.col : A.inlineRow,
            stacked ? styles.touchAction : styles.button,
          )}
          onClick={action.onClick}
        >
          <LucideIcon name={action.icon} size={stacked ? 18 : 14} />
          {stacked ? <span>{action.label}</span> : action.label}
        </button>
      </Fragment>
    ))

  const commentField = (
    <textarea
      ref={commentRef}
      className={cx(A.box, styles.commentInput, touch && styles.touchComment)}
      placeholder={t('common.commentPlaceholder')}
      value={comment}
      onChange={(e) => setComment(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          // Explicit cancel discards the optional comment text;
          // the annotation itself stays saved.
          pendingIdRef.current = null
          hide()
          return
        }
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault()
          finishComment(true)
        }
      }}
    />
  )

  const commentActions = (
    <div className={cx(A.row, styles.commentActions, touch && styles.touchActions)}>
      <button
        type="button"
        className={cx(A.plain, A.inlineRow, styles.button, touch && styles.touchSecondary)}
        onClick={() => finishComment(false)}
      >
        {t('toolbar.skipComment')}
      </button>
      <button
        type="button"
        className={cx(A.plain, A.inlineRow, styles.button, styles.buttonAddComment)}
        disabled={!comment.trim()}
        onClick={() => finishComment(true)}
      >
        {t('toolbar.addComment')}
      </button>
    </div>
  )

  if (touch) {
    // A fixed bottom bar and a sheet, both outside the transcript layer: on a
    // phone the anchored toolbar competes with the OS selection menu, and the
    // anchored popover ends up under the soft keyboard. Content coordinates do
    // not help there, so this path rides the visual viewport instead.
    const bottom = `calc(${viewport.inset}px + 8px + env(safe-area-inset-bottom, 0px))`
    return createPortal(
      <>
        {phase === 'idle' ? (
          <div
            ref={toolbarRef}
            className={cx(A.row, styles.touchBar)}
            style={{ bottom }}
            role="toolbar"
            aria-label={t('toolbar.aria')}
            data-dsq-toolbar="true"
            data-touch="true"
            onPointerDown={handleToolbarPointerDown}
          >
            {actionRow(true)}
          </div>
        ) : null}
        {phase === 'comment' ? (
          <>
            <div className={styles.touchScrim} aria-hidden="true" />
            <div
              ref={commentWrapRef}
              className={cx(A.col, styles.touchSheet)}
              style={{
                bottom,
                maxHeight: `${Math.max(240, Math.round(viewport.height * 0.72))}px`,
              }}
              role="dialog"
              aria-label={t('toolbar.commentDialogAria')}
            >
              <div className={cx(A.row, styles.touchSheetHead)}>
                <span className={styles.touchSheetTitle}>{t('toolbar.commentHint')}</span>
                <button
                  type="button"
                  className={cx(A.plain, A.gridMid, styles.touchSheetClose)}
                  aria-label={t('common.close')}
                  onClick={closeCommentSheet}
                >
                  <LucideIcon name="x" size={18} />
                </button>
              </div>
              <div className={styles.touchQuote}>{active.text}</div>
              {commentField}
              {commentActions}
            </div>
          </>
        ) : null}
        {status ? (
          <div
            className={styles.touchStatus}
            style={{ bottom: `calc(${viewport.inset}px + 72px + env(safe-area-inset-bottom, 0px))` }}
            role="status"
          >
            {status}
          </div>
        ) : null}
      </>,
      document.body,
    )
  }

  return createPortal(
    <>
      <div
        ref={toolbarRef}
        className={cx(A.row, styles.toolbar)}
        style={phase === 'comment' ? undefined : toolbarStyle}
        role="toolbar"
        aria-label={t('toolbar.aria')}
        data-dsq-toolbar="true"
        data-anchor={phase === 'comment' ? 'popover-top' : active.below ? 'below' : 'above'}
        onPointerDown={handleToolbarPointerDown}
      >
        {phase === 'comment' ? (
          <div className={cx(A.inlineRow, styles.toolbarInner)}>
            <span
              style={{
                padding: '0 8px',
                fontSize: 13,
                opacity: 0.8,
                whiteSpace: 'nowrap',
              }}
            >
              {t('toolbar.commentHint')}
            </span>
          </div>
        ) : (
          <div className={cx(A.inlineRow, styles.toolbarInner)}>{actionRow(false)}</div>
        )}
      </div>
      {phase === 'comment' ? (
        <div
          ref={commentWrapRef}
          className={cx(A.col, styles.commentPop)}
          role="dialog"
          aria-label={t('toolbar.commentDialogAria')}
          onPointerDown={handleToolbarPointerDown}
        >
          {commentField}
          {commentActions}
        </div>
      ) : null}
      {status ? (
        <div className={styles.status} style={toolbarStyle} role="status">
          {status}
        </div>
      ) : null}
    </>,
    active.layer.host,
  )
}
