import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { getConfig, resolveTriggers, subscribeConfig } from '../config.ts'
import {
  readSelectionSnapshot,
  selectionFirstLineRect,
  toolbarShiftWithin,
  type SelectionSnapshot,
} from '../dom/selection.ts'
import { activeLocale } from '../i18n.ts'
import { ModelSelect } from '../model/ModelSelect.tsx'
import { isAlreadyTargetLanguage } from '../translate.ts'
import {
  selectionActions,
  type SelectionActionEntry,
  type SelectionActionKey,
} from './actions.ts'
import { SelectionMenu } from './SelectionMenu.tsx'
import { popoverEnter } from './popover-keys.ts'
import { ToolbarView } from './ToolbarView.tsx'
import { useAnnotationFlow } from './useAnnotationFlow.ts'
import { useCommentPlacement } from './useCommentPlacement.ts'
import { useHandoffFlow, targetName } from './useHandoffFlow.ts'
import { useSelectionMenu } from './useSelectionMenu.ts'
import { useSelectionWatcher, type SelectionPhase } from './useSelectionWatcher.ts'
import { useSideQuestion } from './useSideQuestion.ts'
import { useSystemActions } from './useSystemActions.ts'
import { useTranslatePopover } from './useTranslatePopover.ts'
import { runtime, type SelectionBridge } from '../runtime.ts'
import { useLocale } from '../useLocale.ts'
import { bindAnnotationSession, subscribeAnnotations } from '../state/annotation-store.ts'
import { ensureToolbarStyles } from '../styles.ts'
import { useCoarsePointer, useVisualViewport } from '../ui/touch.ts'
import { SessionTargetPicker } from './SessionTargetPicker.tsx'

export interface SelectionToolbarProps {
  sessionId?: string
}

/** Cap for the auto-growing comment box; beyond this it scrolls internally. */
const COMMENT_MAX_HEIGHT = 220

/**
 * Selection coordinator: owns the latched selection, the phase machine and the
 * dismissal order. Each action's own state and lifecycle lives in a flow hook
 * next to this file (menu, annotation, side question, handoff, translate,
 * system hand-offs); this component only wires them to the shared surfaces.
 */
export function SelectionToolbar({ sessionId }: SelectionToolbarProps): ReactNode {
  useLocale()
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const commentWrapRef = useRef<HTMLDivElement | null>(null)
  const commentRef = useRef<HTMLTextAreaElement | null>(null)
  const sideRef = useRef<HTMLTextAreaElement | null>(null)
  const [active, setActive] = useState<SelectionSnapshot | null>(null)
  const [phase, setPhase] = useState<SelectionPhase>('idle')
  const [comment, setComment] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const activeRef = useRef<SelectionSnapshot | null>(null)
  activeRef.current = active
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const touch = useCoarsePointer()
  const viewport = useVisualViewport(touch)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  // `bindAnnotationSession` publishes on every rebind; subscribe so the source
  // session id (and its workspace) resolves even when the prop is absent.
  const activeSessionId = useSyncExternalStore(
    subscribeAnnotations,
    () => sessionId ?? runtime.sessionId,
    () => sessionId,
  )

  const { menu, menuRef, open: openMenuState, dismiss: dismissMenu } = useSelectionMenu()

  const placeCommentPop = useCommentPlacement({
    touch,
    phase,
    active,
    toolbarRef,
    commentWrapRef,
  })

  // The flows need a `hide` that already includes their own reset, while they
  // themselves are created first; route through a ref so nothing is circular.
  const hideRef = useRef<() => void>(() => {})
  const hideCurrent = useCallback(() => hideRef.current(), [])

  const translate = useTranslatePopover({
    ...(sessionId === undefined ? {} : { sessionId }),
    activeRef,
    phase,
    touch,
    commentWrapRef,
    placeCommentPop,
    hide: hideCurrent,
    setStatus,
    setActive,
    dismissMenu,
    setPhase,
  })
  const handoff = useHandoffFlow({
    ...(activeSessionId === undefined ? {} : { activeSessionId }),
    activeRef,
    comment,
    setComment,
    hide: hideCurrent,
    touch,
    phaseRef,
    dismissMenu,
    setStatus,
    setActive,
    setPhase,
  })
  const annotation = useAnnotationFlow({
    touch,
    commentRef,
    hide: hideCurrent,
    setStatus,
    setActive,
    setComment,
    dismissMenu,
    setPhase,
  })
  const side = useSideQuestion({
    phase,
    activeRef,
    hide: hideCurrent,
    setStatus,
    setActive,
    dismissMenu,
    setPhase,
  })
  const system = useSystemActions({ hide: hideCurrent, setStatus })

  const hide = useCallback(() => {
    dismissMenu()
    translate.reset()
    handoff.reset()
    annotation.reset()
    side.reset()
    setActive(null)
    setPhase('idle')
    setComment('')
    setStatus(null)
  }, [annotation.reset, dismissMenu, handoff.reset, side.reset, translate.reset])
  hideRef.current = hide

  /** Latch the selection and anchor; the menu outlives later refresh passes. */
  const openMenu = useCallback(
    (
      snapshot: SelectionSnapshot,
      x: number,
      y: number,
      initialFocus: 'first' | 'menu',
    ) => {
      setStatus(null)
      setActive(snapshot)
      openMenuState(snapshot, x, y, initialFocus)
    },
    [openMenuState],
  )

  /**
   * A live selection inside our own popover is the reader selecting result
   * text (the translation, the quote), not a new passage to quote. Treating it
   * as "no selection" would close the popover mid-drag, which read as the
   * result being unselectable.
   */
  const selectionInOwnSurface = useCallback((): boolean => {
    // The target picker latches its own snapshot and owns focus (search field).
    // Any refresh while it is open would read a collapsed selection and drop
    // the very surface the reader is interacting with.
    if (handoff.pickerRef.current !== null) return true
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0) return false
    const owns = (root: HTMLElement | null, node: Node | null): boolean =>
      root !== null && node !== null && root.contains(node)
    const { anchorNode, focusNode } = selection
    return (
      owns(commentWrapRef.current, anchorNode) ||
      owns(commentWrapRef.current, focusNode) ||
      owns(toolbarRef.current, anchorNode) ||
      owns(toolbarRef.current, focusNode)
    )
  }, [handoff.pickerRef])

  const refresh = useCallback(() => {
    if (selectionInOwnSurface()) return
    const next = readSelectionSnapshot(toolbarRef.current)
    if (!next) {
      // A menu latched on a selection that no longer exists has nothing to act
      // on; drop it together with the idle toolbar.
      dismissMenu()
      // A translation belongs to the exact passage it was requested for.
      if (phaseRef.current === 'translate') {
        hide()
        return
      }
      // Keep an open comment popover; only drop idle toolbar when selection dies.
      if (phaseRef.current === 'idle') setActive(null)
      return
    }
    // The menu retains its own snapshot; retargeting is a new right-click or a
    // new shortcut command, not a silent swap under the pointer.
    if (menuRef.current && menuRef.current.snapshot.text !== next.text) dismissMenu()
    // Touch keeps its bottom bar regardless of the trigger mode.
    if (!touch && !resolveTriggers(getConfig()).auto) {
      // The right-click / shortcut menu is a separate entry point: its host
      // must stay mounted while the selection is still the menu's own.
      if (phaseRef.current === 'idle' && !menuRef.current) setActive(null)
      return
    }
    const current = activeRef.current
    // A different passage means the old translation no longer belongs here.
    if (phaseRef.current === 'translate' && current && current.text !== next.text) {
      hide()
      return
    }
    if (phaseRef.current === 'comment' && current && current.text !== next.text) {
      // A new range replaces the comment step: keep the typed comment on the
      // old (already saved) annotation, then retarget the toolbar.
      annotation.flush()
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
  }, [
    annotation.flush,
    dismissMenu,
    handoff.pickerRef,
    hide,
    menuRef,
    selectionInOwnSurface,
    touch,
  ])

  // A settings change must take effect without a reload: re-read the live
  // selection so switching back to `auto` raises the toolbar again. The open
  // menu closes first — its trigger may have just been turned off.
  useEffect(
    () =>
      subscribeConfig(() => {
        dismissMenu()
        refresh()
      }),
    [dismissMenu, refresh],
  )

  useSelectionWatcher({
    toolbarRef,
    commentWrapRef,
    phaseRef,
    touch,
    dismissMenu,
    refresh,
    flushComment: annotation.flush,
    hide,
    openMenu,
  })

  // Host shortcut commands → mounted toolbar. Only a fine pointer publishes the
  // bridge: the commands resolve against it and report "no selection" when the
  // reader is on a touch layout. It sits below the action callbacks because
  // `add` enters the comment step through them.
  useEffect(() => {
    if (touch) return
    const bridge: SelectionBridge = {
      state: () => {
        if (phaseRef.current !== 'idle') return 'busy'
        return readSelectionSnapshot(toolbarRef.current) ? 'ready' : 'no-selection'
      },
      open: () => {
        if (phaseRef.current !== 'idle') return
        const snapshot = readSelectionSnapshot(toolbarRef.current)
        if (!snapshot) return
        const rect = selectionFirstLineRect()
        if (!rect) return
        openMenu(snapshot, rect.left, rect.bottom, 'first')
      },
      add: () => {
        if (phaseRef.current !== 'idle') return
        const snapshot = readSelectionSnapshot(toolbarRef.current)
        if (!snapshot) return
        annotation.begin(snapshot)
      },
    }
    runtime.selection = bridge
    return () => {
      if (runtime.selection === bridge) delete runtime.selection
    }
  }, [annotation.begin, openMenu, touch])

  // The composer summary card lives in the seat (z 7) and can reach over the
  // scroller area; the popover is clipped to the scroller at z 6, so the card
  // would paint over it. Lift the host only while the comment step is open.
  const layer = active?.layer
  useLayoutEffect(() => {
    if (!layer || touch) return
    layer.setAboveComposer(
      phase === 'comment' || phase === 'handoff' || phase === 'side' || phase === 'translate',
    )
    return () => layer.setAboveComposer(false)
  }, [layer, phase, touch])

  // Focus once when the box opens, not on every re-placement. On touch the
  // comment is optional, so the sheet waits for a tap instead of raising the
  // soft keyboard the moment it appears. The translate popover focuses its own
  // language button (no text field).
  useEffect(() => {
    if (touch) return
    if (phase === 'comment' || phase === 'handoff') commentRef.current?.focus()
    else if (phase === 'side') sideRef.current?.focus()
  }, [phase, touch])

  // Grow the comment box with its content (up to a cap) instead of letting it
  // scroll internally: a fixed 64px box starts scrolling after a few wrapped
  // lines, which reads as a character limit. Re-place the popover afterwards so
  // a taller box still flips and clamps correctly.
  useLayoutEffect(() => {
    if (phase === 'idle') return
    const area =
      phase === 'comment' || phase === 'handoff' ? commentRef.current : sideRef.current
    if (!area) return
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight, COMMENT_MAX_HEIGHT)}px`
    if (!touch) placeCommentPop()
  }, [phase, comment, side.sideText, placeCommentPop, touch])

  const handleToolbarPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    // Text fields must keep their native press: focus and caret placement are
    // the default action. Cancelling it everywhere left the composer unable to
    // regain focus once the model chip had taken it. The selectable regions
    // (quote and translation body) behave the same way: their press starts a
    // native text selection, which is the only way to copy part of a result.
    const target = event.target
    if (
      target instanceof Element &&
      target.closest(
        'textarea, input, [contenteditable="true"], [data-dsq-selectable]',
      ) !== null
    ) {
      event.stopPropagation()
      return
    }
    event.preventDefault()
    event.stopPropagation()
  }, [])

  /** Dismissal without an action hands control back to the normal toolbar rules. */
  const closeMenu = useCallback(() => {
    if (!dismissMenu()) return
    refresh()
  }, [dismissMenu, refresh])

  /** Dispatch a shared action against the range the calling surface latched. */
  const runAction = useCallback(
    (key: SelectionActionKey, snapshot: SelectionSnapshot, surface: 'toolbar' | 'menu' = 'toolbar') => {
      switch (key) {
        case 'open':
          system.openLink(snapshot)
          return
        case 'copy':
          void system.copy(snapshot)
          return
        case 'add':
          annotation.begin(snapshot)
          return
        case 'handoff': {
          const defaultTarget = handoff.directory.defaultTarget
          if (surface === 'menu') {
            const latched = menuRef.current
            const at = latched ? { x: latched.x, y: latched.y } : undefined
            // The picker replaces the menu: keeping both open left the menu
            // painted above the list and its scroll listener dismissed both.
            dismissMenu()
            handoff.openPicker(snapshot, at)
          } else if (defaultTarget) {
            handoff.begin(snapshot, defaultTarget)
          } else {
            handoff.openPicker(snapshot)
          }
          return
        }
        case 'translate':
          translate.begin(snapshot)
          return
        case 'side':
          side.open(snapshot)
      }
    },
    [
      annotation.begin,
      dismissMenu,
      handoff.begin,
      handoff.directory.defaultTarget,
      handoff.openPicker,
      menuRef,
      side.open,
      system.copy,
      system.openLink,
      translate.begin,
    ],
  )

  const handleCommentKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (phase === 'handoff') {
          handoff.cancel()
          return
        }
        // Explicit cancel discards the optional comment text;
        // the annotation itself stays saved.
        hide()
        return
      }
      // Same gestures as the button and the side composer: the host's submit
      // predicate (Enter, Cmd/Ctrl+Enter) commits; an empty box commits
      // nothing, matching the button's disabled state. Shift+Enter keeps its
      // native line break.
      const gesture = popoverEnter(event.nativeEvent)
      if (gesture === 'submit') {
        event.preventDefault()
        if (phase === 'handoff') {
          if (!handoff.busy) handoff.commit(false)
        } else if (comment.trim()) {
          annotation.finish(true)
        }
      }
    },
    [annotation.finish, comment, handoff.busy, handoff.cancel, handoff.commit, hide, phase],
  )

  /**
   * The toolbar is centered on the selection, so near either edge of the
   * transcript half of it lands outside the clipped scroller. Measure it after
   * mount (and whenever its width changes) and shift it back inside the band.
   * A layout effect runs before paint, so the clamped position is the first
   * visible one; the custom property is read by the toolbar transform and its
   * entrance keyframes.
   */
  useLayoutEffect(() => {
    if (touch || phase !== 'idle') return
    const el = toolbarRef.current
    if (!el || !active) return
    const clamp = (): void => {
      // Measure unshifted: the rect must reflect the centered position.
      el.style.setProperty('--dsq-toolbar-shift', '0px')
      const shift = toolbarShiftWithin(el.getBoundingClientRect(), active.layer.bounds())
      el.style.setProperty('--dsq-toolbar-shift', `${Math.round(shift)}px`)
    }
    clamp()
    const observer = new ResizeObserver(clamp)
    observer.observe(el)
    return () => observer.disconnect()
  }, [active, phase, touch])

  if (!active) return null

  const visibilityFor = (text: string): { hideTranslate: boolean } => ({
    hideTranslate:
      config.translateHideSameLanguage &&
      isAlreadyTargetLanguage(text, config.translateTarget, activeLocale()),
  })
  const toolbarStyle: CSSProperties = { left: active.left, top: active.top }
  // The Remote mount publishes these bridges after activation, so re-read them
  // on every render instead of memoising: an entry point that is unavailable at
  // boot must become usable as soon as the bridge lands.
  const availability = {
    sideTask: runtime.sideTask !== undefined,
    translate: runtime.translate !== undefined,
  }
  const actions: SelectionActionEntry[] = selectionActions(
    active,
    handoff.options,
    visibilityFor(active.text),
    availability,
  ).map((action) => ({
    ...action,
    onClick: () => runAction(action.key, active),
  }))

  return (
    <>
      <ToolbarView
        touch={touch}
        phase={phase}
        active={active}
        status={status}
        viewport={viewport}
        actions={actions}
        comment={comment}
        sideText={side.sideText}
        sending={side.sending}
        sideRef={sideRef}
        sideModelPicker={
          side.sideDirectory ? (
            <ModelSelect
              directory={side.sideDirectory}
              value={side.sideModel}
              onChange={side.setSideModel}
            />
          ) : undefined
        }
        toolbarStyle={toolbarStyle}
        toolbarRef={toolbarRef}
        commentWrapRef={commentWrapRef}
        commentRef={commentRef}
        menuOpen={menu !== null || handoff.picker !== null}
        onToolbarPointerDown={handleToolbarPointerDown}
        onCommentChange={setComment}
        onCommentKeyDown={handleCommentKeyDown}
        onFinishComment={annotation.finish}
        onCloseSheet={annotation.closeSheet}
        onSideChange={side.setSideText}
        onSideKeyDown={side.onKeyDown}
        onSendSide={side.send}
        onCancelSide={hide}
        onHandoffPick={() => {
          const latched = menuRef.current
          handoff.openPicker(active, latched ? { x: latched.x, y: latched.y } : undefined)
        }}
        handoff={
          phase === 'handoff'
            ? {
                targetName: handoff.target ? targetName(handoff.target) : '',
                targetMeta: handoff.target?.workspaceTitle ?? '',
                busy: handoff.busy,
                error: handoff.error,
                onChangeTarget: () => handoff.openPicker(active),
                onPut: () => handoff.commit(false),
                onPutAndOpen: () => handoff.commit(true),
                onCancel: handoff.cancel,
              }
            : null
        }
        translate={
          phase === 'translate'
            ? {
                target: translate.target,
                state: translate.translation ?? { status: 'pending' },
                copied: translate.copied,
                onTarget: translate.changeTarget,
                onCopy: translate.copy,
                onRetry: translate.retry,
                onStop: hide,
                onClose: translate.close,
              }
            : null
        }
      />
      {handoff.picker ? (
        <SessionTargetPicker
          directory={handoff.picker.directory}
          selectedId={handoff.picker.selectedId}
          x={handoff.picker.x}
          y={handoff.picker.y}
          touch={touch}
          onPick={handoff.pick}
          onClose={handoff.closePicker}
        />
      ) : null}
      {menu ? (
        <SelectionMenu
          entries={selectionActions(
            menu.snapshot,
            handoff.options,
            visibilityFor(menu.snapshot.text),
            availability,
          ).map((action) => ({
            ...action,
            label: action.key === 'handoff' ? (action.menuLabel ?? action.label) : action.label,
            onClick: () => runAction(action.key, menu.snapshot, 'menu'),
          }))}
          x={menu.x}
          y={menu.y}
          initialFocus={menu.initialFocus}
          onClose={closeMenu}
        />
      ) : null}
    </>
  )
}
