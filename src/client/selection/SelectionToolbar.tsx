import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
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
  clearNativeSelection,
  copyText,
  readSelectionSnapshot,
  selectionFirstLineRect,
  toolbarShiftWithin,
  type SelectionSnapshot,
} from '../dom/selection.ts'
import { focusComposer } from '../dom/composer-host.ts'
import { linkTarget } from '../dom/selection-url.ts'
import { activeLocale, t } from '../i18n.ts'
import { ModelSelect } from '../model/ModelSelect.tsx'
import type { ModelChoice } from '../model/types.ts'
import {
  isAlreadyTargetLanguage,
  MAX_TRANSLATE_CHARS,
  resolveTranslatePrompt,
  resolveTranslateTarget,
  type TranslateLanguage,
} from '../translate.ts'
import { readTranslation, writeTranslation } from '../translate-cache.ts'
import {
  selectionActions,
  type SelectionActionEntry,
  type SelectionActionKey,
} from './actions.ts'
import { SelectionMenu } from './SelectionMenu.tsx'
import { popoverEnter } from './popover-keys.ts'
import { ToolbarView } from './ToolbarView.tsx'
import type { TranslationState } from './translation-view.ts'
import { useCommentPlacement } from './useCommentPlacement.ts'
import { useSelectionWatcher, type SelectionPhase } from './useSelectionWatcher.ts'
import { runtime, type SelectionBridge } from '../runtime.ts'
import { useLocale } from '../useLocale.ts'
import {
  bindAnnotationSession,
  saveAnnotation,
  subscribeAnnotations,
  updateAnnotationComment,
} from '../state/annotation-store.ts'
import { ensureToolbarStyles } from '../styles.ts'
import { showToast } from '../ui/toast.ts'
import { useCoarsePointer, useVisualViewport } from '../ui/touch.ts'
import { putHandoff } from './handoff-actions.ts'
import { openConversation, sessionTitleOf } from './navigation.ts'
import { SessionTargetPicker } from './SessionTargetPicker.tsx'
import {
  buildTargetDirectory,
  liveTitle,
  targetId,
  type SessionListSnapshot,
  type TargetDirectory,
  type TargetSession,
  type WorkspaceListSnapshot,
} from './session-targets.ts'
import { subscribeHandoffHost } from '../runtime.ts'

export interface SelectionToolbarProps {
  sessionId?: string
}

/** Latched selection + viewport anchor of the open right-click/shortcut menu. */
interface MenuState {
  readonly snapshot: SelectionSnapshot
  readonly x: number
  readonly y: number
  /** Pointer opens keep the menu itself focused so no item looks selected. */
  readonly initialFocus: 'first' | 'menu'
}

/** Cap for the auto-growing comment box; beyond this it scrolls internally. */
const COMMENT_MAX_HEIGHT = 220

const EMPTY_SESSIONS: SessionListSnapshot = { ids: [], byId: {} }
const EMPTY_WORKSPACES: WorkspaceListSnapshot = { items: [] }
const NO_SUBSCRIBE = (): (() => void) => () => {}

function sessionsSnapshot(): SessionListSnapshot {
  try {
    return runtime.handoffHost?.sessionsSnapshot() ?? EMPTY_SESSIONS
  } catch {
    return EMPTY_SESSIONS
  }
}

function workspacesSnapshot(): WorkspaceListSnapshot {
  try {
    return runtime.handoffHost?.workspacesSnapshot() ?? EMPTY_WORKSPACES
  } catch {
    return EMPTY_WORKSPACES
  }
}

/** Target display name; "new session" has no live title of its own. */
function targetName(target: TargetSession): string {
  return target.kind === 'new' ? t('handoff.newSession') : target.title
}

interface PickerState {
  readonly snapshot: SelectionSnapshot
  readonly x: number
  readonly y: number
  readonly directory: TargetDirectory
  readonly selectedId?: string
}

export function SelectionToolbar({ sessionId }: SelectionToolbarProps): ReactNode {
  useLocale()
  const toolbarRef = useRef<HTMLDivElement | null>(null)
  const commentWrapRef = useRef<HTMLDivElement | null>(null)
  const commentRef = useRef<HTMLTextAreaElement | null>(null)
  const sideRef = useRef<HTMLTextAreaElement | null>(null)
  const [active, setActive] = useState<SelectionSnapshot | null>(null)
  const [phase, setPhase] = useState<SelectionPhase>('idle')
  const [comment, setComment] = useState('')
  const [sideText, setSideText] = useState('')
  /** `null` follows the main conversation's route. */
  const [sideModel, setSideModel] = useState<ModelChoice | null>(null)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const [menu, setMenu] = useState<MenuState | null>(null)
  /** Latched target picker; its directory is frozen while it is open. */
  const [picker, setPicker] = useState<PickerState | null>(null)
  const [handoffTarget, setHandoffTarget] = useState<TargetSession | null>(null)
  const [handoffBusy, setHandoffBusy] = useState(false)
  const [handoffError, setHandoffError] = useState<string | null>(null)
  /** Comment typed for a handoff survives a cancel until it is committed. */
  const lastHandoffRef = useRef<{ text: string; comment: string } | null>(null)
  const handoffTargetRef = useRef<TargetSession | null>(null)
  handoffTargetRef.current = handoffTarget
  const [translation, setTranslation] = useState<TranslationState | null>(null)
  const [translateTarget, setTranslateTarget] = useState<TranslateLanguage>('en')
  const [translateCopied, setTranslateCopied] = useState(false)
  /** Invalidates a late response after close, stop, or a new target. */
  const translateRunRef = useRef(0)
  /** Aborts the host call and its stream when the surface or target changes. */
  const translateControllerRef = useRef<AbortController | null>(null)
  const copiedTimerRef = useRef<number | null>(null)
  const activeRef = useRef<SelectionSnapshot | null>(null)
  activeRef.current = active
  const menuRef = useRef<MenuState | null>(null)
  menuRef.current = menu
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  /** Annotation saved when the comment step opened; the box only edits it. */
  const pendingIdRef = useRef<string | null>(null)
  const touch = useCoarsePointer()
  const viewport = useVisualViewport(touch)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)
  // The handoff host is published asynchronously by the workspace injection;
  // re-read it (and its snapshots) when it appears or a session changes.
  const handoffHost = useSyncExternalStore(
    subscribeHandoffHost,
    () => runtime.handoffHost,
    () => undefined,
  )
  const sessions = useSyncExternalStore(
    handoffHost ? handoffHost.subscribeSessions : NO_SUBSCRIBE,
    sessionsSnapshot,
    () => EMPTY_SESSIONS,
  )
  const workspaces = useSyncExternalStore(
    handoffHost ? handoffHost.subscribeWorkspaces : NO_SUBSCRIBE,
    workspacesSnapshot,
    () => EMPTY_WORKSPACES,
  )
  // `bindAnnotationSession` publishes on every rebind; subscribe so the source
  // session id (and its workspace) resolves even when the prop is absent.
  const activeSessionId = useSyncExternalStore(
    subscribeAnnotations,
    () => sessionId ?? runtime.sessionId,
    () => sessionId,
  )
  const handoffDirectory = useMemo(
    () =>
      buildTargetDirectory({
        currentSessionId: activeSessionId,
        sessions: handoffHost ? sessions : undefined,
        workspaces: handoffHost ? workspaces : undefined,
      }),
    [activeSessionId, handoffHost, sessions, workspaces],
  )
  const handoffOptions = useMemo(() => {
    const target = handoffDirectory.defaultTarget
    return {
      available: handoffHost !== undefined && handoffDirectory.canHandoff,
      label: target
        ? t('toolbar.handoffTo', { target: targetName(target) })
        : t('toolbar.handoff'),
      ...(target ? { targetName: targetName(target) } : {}),
      menuLabel: t('handoff.menu'),
    }
  }, [handoffDirectory, handoffHost])

  // Only the side composer offers a model override, so the session directory
  // is resolved when that phase opens instead of for every selection. Reuse
  // mode has no per-question route: the child keeps its creation model.
  const sideDirectory = useMemo(
    () =>
      phase === 'side' && config.sideTaskMode === 'separate' && runtime.sessionId
        ? runtime.modelDirectoryFor?.(runtime.sessionId)
        : undefined,
    [phase, config.sideTaskMode],
  )

  useEffect(() => {
    ensureToolbarStyles()
    if (sessionId) bindAnnotationSession(sessionId)
  }, [sessionId])

  /**
   * Drop the menu state **and** its ref in one tick. A refresh that runs right
   * after a dismissal must see the menu as closed; reading the stale ref made
   * it keep `active`, which raised the auto toolbar in contextmenu mode.
   */
  const dismissMenu = useCallback((): boolean => {
    if (!menuRef.current) return false
    menuRef.current = null
    setMenu(null)
    return true
  }, [])

  const hide = useCallback(() => {
    pendingIdRef.current = null
    dismissMenu()
    translateRunRef.current += 1
    translateControllerRef.current?.abort()
    translateControllerRef.current = null
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = null
    }
    setActive(null)
    setPhase('idle')
    setComment('')
    setPicker(null)
    setHandoffTarget(null)
    setHandoffBusy(false)
    setHandoffError(null)
    setSideText('')
    setSideModel(null)
    setSending(false)
    setStatus(null)
    setTranslation(null)
    setTranslateCopied(false)
  }, [dismissMenu])

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
  const saveSelection = useCallback((snapshot: SelectionSnapshot): string => {
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

  /**
   * "Add annotation" is the commit: the quote is saved immediately, with or
   * without a comment. The popover only edits that saved entry, so dismissing
   * it (outside click, new selection) can never undo the annotation.
   */
  const beginComment = useCallback(
    (snapshot: SelectionSnapshot) => {
      pendingIdRef.current = saveSelection(snapshot)
      setActive(snapshot)
      dismissMenu()
      setPhase('comment')
      setComment('')
      setStatus(null)
    },
    [dismissMenu, saveSelection],
  )

  /**
   * Cross-session handoff: nothing is written until 放入 is pressed. Unlike
   * "add annotation", opening this panel must not create the target entry —
   * Escape or an outside press would otherwise leave a stray pending card.
   */
  const beginHandoff = useCallback(
    (snapshot: SelectionSnapshot, target: TargetSession | null) => {
      if (!target) return
      setStatus(null)
      setActive(snapshot)
      dismissMenu()
      setHandoffTarget(target)
      setHandoffBusy(false)
      setHandoffError(null)
      const kept = lastHandoffRef.current
      setComment(kept && kept.text === snapshot.text ? kept.comment : '')
      setPhase('handoff')
    },
    [dismissMenu],
  )

  /**
   * Freeze the target directory for the lifetime of the picker.
   *
   * The picker is `position: fixed`, so it must receive viewport coordinates.
   * The snapshot anchor is in content coordinates (it scrolls with the text);
   * a scrolled conversation would otherwise place the panel far off-screen.
   */
  const openPicker = useCallback(
    (snapshot: SelectionSnapshot, at?: { x: number; y: number }) => {
      const directory = buildTargetDirectory({
        currentSessionId: activeSessionId,
        sessions: handoffHost ? sessionsSnapshot() : undefined,
        workspaces: handoffHost ? workspacesSnapshot() : undefined,
      })
      const fromContent = snapshot.layer.fromContent(snapshot.left, snapshot.top)
      const point = at ?? { x: fromContent.left, y: fromContent.top }
      const current = handoffTargetRef.current
      setPicker({
        snapshot,
        x: point.x,
        y: point.y,
        directory,
        selectedId: current
          ? targetId(current)
          : directory.defaultTarget
            ? targetId(directory.defaultTarget)
            : undefined,
      })
    },
    [activeSessionId, handoffHost],
  )

  const cancelHandoff = useCallback(() => {
    const snapshot = activeRef.current
    lastHandoffRef.current = snapshot ? { text: snapshot.text, comment } : null
    hide()
  }, [comment, hide])

  /** Resolve one target and write both sides; navigation only for 并前往. */
  const commitHandoff = useCallback(
    (go: boolean) => {
      const snapshot = activeRef.current
      const target = handoffTargetRef.current
      const sourceId = activeSessionId
      if (!snapshot || !target || !sourceId || handoffBusy) return
      setHandoffBusy(true)
      setHandoffError(null)
      void putHandoff({
        sourceSessionId: sourceId,
        sourceTitle: sessionTitleOf(sourceId, liveTitle(sessions.byId[sourceId], sourceId)),
        snapshot,
        target,
        directory: handoffDirectory,
        comment,
      }).then(
        (outcome) => {
          setHandoffBusy(false)
          if (!outcome.ok || !outcome.targetId) {
            setHandoffError(outcome.error ?? t('handoff.failed'))
            return
          }
          const name = targetName(target)
          showToast(
            outcome.persisted === false
              ? `${t('handoff.doneNamed', { target: name })} · ${t('handoff.memoryOnly')}`
              : t('handoff.doneNamed', { target: name }),
          )
          lastHandoffRef.current = null
          setHandoffTarget(null)
          setComment('')
          clearNativeSelection()
          hide()
          if (go && !openConversation(outcome.targetId)) {
            showToast(t('handoff.openFailed'))
          }
        },
        (error) => {
          setHandoffBusy(false)
          console.error('dsh-select-quote: handoff failed', error)
          setHandoffError(error instanceof Error ? error.message : String(error))
        },
      )
    },
    [activeSessionId, comment, handoffBusy, handoffDirectory, hide, sessions],
  )

  const pickHandoffTarget = useCallback(
    (target: TargetSession) => {
      setPicker(null)
      if (phaseRef.current === 'handoff') {
        setHandoffTarget(target)
        setHandoffError(null)
        return
      }
      const latched = activeRef.current
      if (latched) beginHandoff(latched, target)
    },
    [beginHandoff],
  )

  /**
   * A live selection inside our own popover is the reader selecting result
   * text (the translation, the quote), not a new passage to quote. Treating it
   * as "no selection" would close the popover mid-drag, which read as the
   * result being unselectable.
   */
  const selectionInOwnSurface = useCallback((): boolean => {
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
  }, [])

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
  }, [dismissMenu, flushComment, hide, selectionInOwnSurface, touch])

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
      setMenu({ snapshot, x, y, initialFocus })
    },
    [],
  )

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
    flushComment,
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
        beginComment(snapshot)
      },
    }
    runtime.selection = bridge
    return () => {
      if (runtime.selection === bridge) delete runtime.selection
    }
  }, [beginComment, openMenu, touch])

  const placeCommentPop = useCommentPlacement({
    touch,
    phase,
    active,
    toolbarRef,
    commentWrapRef,
  })

  // The result area grows while text streams in; re-place once per frame so a
  // flipped popover keeps clearing the selection and the viewport edge.
  const placeFrameRef = useRef<number | null>(null)
  const schedulePlace = useCallback(() => {
    if (placeFrameRef.current !== null) return
    placeFrameRef.current = window.requestAnimationFrame(() => {
      placeFrameRef.current = null
      placeCommentPop()
    })
  }, [placeCommentPop])
  useEffect(
    () => () => {
      if (placeFrameRef.current !== null) {
        window.cancelAnimationFrame(placeFrameRef.current)
        placeFrameRef.current = null
      }
    },
    [],
  )
  useLayoutEffect(() => {
    if (phase !== 'translate') return
    schedulePlace()
  }, [phase, schedulePlace, translateTarget, translation])

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
  // soft keyboard the moment it appears.
  useEffect(() => {
    if (touch) return
    if (phase === 'comment' || phase === 'handoff') commentRef.current?.focus()
    else if (phase === 'side') sideRef.current?.focus()
  }, [phase, touch])

  // No input owns the translation popover, so Escape is handled at the window.
  // An open language menu owns its own Escape; leave that press to it.
  useEffect(() => {
    if (phase !== 'translate') return
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      const focused = document.activeElement
      if (focused instanceof Element && focused.closest('[data-dsq-menu]') !== null) return
      event.preventDefault()
      clearNativeSelection()
      hide()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hide, phase])

  // Keyboard opens land on the language button; the popover has no text field
  // to focus. Touch keeps the sheet free of a raised keyboard.
  useEffect(() => {
    if (phase !== 'translate' || touch) return
    queueMicrotask(() => {
      commentWrapRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    })
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
  }, [phase, comment, sideText, placeCommentPop, touch])

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

  /** Copy a latched quote; a failure leaves the caller's surface in place. */
  const copySnapshot = useCallback(
    async (snapshot: SelectionSnapshot) => {
      try {
        await copyText(snapshot.text)
        clearNativeSelection()
        hide()
      } catch {
        setStatus(t('toolbar.copyFailed'))
      }
    },
    [hide],
  )

  /**
   * Hand the selected link to the system browser.
   *
   * `window.open` deliberately bypasses the host's in-app sidebar browser: the
   * desktop shell's window-open handler sends http(s) straight to
   * `shell.openExternal`, so the page never renders inside the client (loading
   * arbitrary URLs there is what wedges it). Only http(s) selections get this
   * button — every other scheme is refused by that handler.
   */
  const openLinkSnapshot = useCallback(
    (snapshot: SelectionSnapshot) => {
      const url = linkTarget(snapshot.text, snapshot.anchorHref)
      if (!url) return
      window.open(url, '_blank', 'noopener,noreferrer')
      clearNativeSelection()
      hide()
    },
    [hide],
  )

  /** Open the side-task composer for the latched quote. */
  const openSide = useCallback(
    (snapshot: SelectionSnapshot) => {
      if (!runtime.sideTask) {
        setStatus(t('toolbar.sideTaskUnavailable'))
        return
      }
      setStatus(null)
      // The popover renders from `active`; pin it to the range this surface
      // latched instead of whatever a later refresh may have picked up.
      setActive(snapshot)
      setSideText('')
      dismissMenu()
      setPhase('side')
    },
    [dismissMenu],
  )

  /** Run one translation; a later attempt invalidates and aborts this stream. */
  const requestTranslation = useCallback(
    (snapshot: SelectionSnapshot, target: TranslateLanguage) => {
      const run = runtime.translate
      translateControllerRef.current?.abort()
      translateControllerRef.current = null
      const generation = ++translateRunRef.current
      setTranslateCopied(false)
      if (snapshot.text.length > MAX_TRANSLATE_CHARS) {
        setTranslation({ status: 'tooLong' })
        return
      }
      // The key mirrors exactly what the host will send: the same text, target,
      // route and resolved prompt, under the same session. A hit skips the call
      // entirely and paints the finished translation at once.
      const settings = getConfig()
      const cacheKey = {
        text: snapshot.text,
        target,
        provider: settings.translateProvider.trim(),
        model: settings.translateModel.trim(),
        prompt: resolveTranslatePrompt(settings.translatePrompt, target),
        sessionId: sessionId ?? '',
      }
      const cached = readTranslation(cacheKey)
      if (cached !== undefined) {
        setTranslation({ status: 'done', text: cached })
        return
      }
      if (!run) {
        console.warn('dsh-select-quote: translation is unavailable; the remote is not mounted')
        setTranslation({ status: 'unavailable' })
        return
      }
      const controller = new AbortController()
      translateControllerRef.current = controller
      setTranslation({ status: 'pending' })
      void run(snapshot, target, controller.signal, (event) => {
        if (generation !== translateRunRef.current) return
        if (event.type === 'thinking') {
          setTranslation((previous) => ({
            status: 'pending',
            text: previous?.text,
            reasoning: previous?.reasoning,
            thinking: event.active,
          }))
          return
        }
        if (event.type === 'reasoning') {
          setTranslation((previous) => ({
            status: 'pending',
            text: previous?.text,
            reasoning: event.text,
            thinking: true,
          }))
          return
        }
        if (event.type === 'text') {
          setTranslation((previous) => ({
            status: 'pending',
            text: event.text,
            reasoning: previous?.reasoning,
            thinking: false,
          }))
          return
        }
        writeTranslation(cacheKey, event.text)
        setTranslation((previous) => ({
          status: 'done',
          text: event.text,
          reasoning: previous?.reasoning,
        }))
      }).then(
        () => {
          if (generation === translateRunRef.current) {
            translateControllerRef.current = null
          }
        },
        (error) => {
          if (generation !== translateRunRef.current || controller.signal.aborted) return
          translateControllerRef.current = null
          const detail = error instanceof Error ? error.message : String(error)
          console.error('dsh-select-quote: translation failed', {
            target,
            chars: snapshot.text.length,
            error,
          })
          setTranslation((previous) => ({
            status: 'error',
            text: previous?.text,
            reasoning: previous?.reasoning,
            error: detail,
          }))
        },
      )
    },
    [sessionId],
  )

  /** Open the translate popover for the latched quote and start at once. */
  const beginTranslate = useCallback(
    (snapshot: SelectionSnapshot) => {
      const target = resolveTranslateTarget(
        snapshot.text,
        getConfig().translateTarget,
        activeLocale(),
      )
      setStatus(null)
      setActive(snapshot)
      dismissMenu()
      setPhase('translate')
      setTranslateTarget(target)
      requestTranslation(snapshot, target)
    },
    [dismissMenu, requestTranslation],
  )

  const changeTranslateTarget = useCallback(
    (target: TranslateLanguage) => {
      const snapshot = activeRef.current
      if (!snapshot) return
      setTranslateTarget(target)
      // The same live config the settings page edits: the next selection and
      // the settings row both start from this pick.
      runtime.setConfigField?.('translateTarget', target)
      requestTranslation(snapshot, target)
    },
    [requestTranslation],
  )

  const copyTranslation = useCallback(() => {
    if (translation?.status !== 'done' || translation.text === undefined) return
    void copyText(translation.text).then(
      () => {
        setTranslateCopied(true)
        if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
        copiedTimerRef.current = window.setTimeout(() => {
          copiedTimerRef.current = null
          setTranslateCopied(false)
        }, 1600)
      },
      () => setStatus(t('toolbar.copyFailed')),
    )
  }, [translation])

  const retryTranslation = useCallback(() => {
    const snapshot = activeRef.current
    if (snapshot) requestTranslation(snapshot, translateTarget)
  }, [requestTranslation, translateTarget])

  const closeTranslation = useCallback(() => {
    clearNativeSelection()
    hide()
  }, [hide])

  const handleSideChange = useCallback((value: string) => {
    setSideText(value)
  }, [])

  /**
   * Send the typed question to the client root, which asks the Host for a
   * fork-backed subagent and opens its conversation in the right sidebar.
   * The composer stays open (with the text) if the call fails.
   */
  const sendSide = useCallback(() => {
    const snapshot = activeRef.current
    const question = sideText.trim()
    if (!snapshot || !question || sending) return
    const run = runtime.sideTask
    if (!run) {
      setStatus(t('toolbar.sideTaskUnavailable'))
      return
    }
    setSending(true)
    setStatus(null)
    void run(snapshot, question, sideModel).then(
      () => {
        setSending(false)
        clearNativeSelection()
        hide()
      },
      (error) => {
        setSending(false)
        setStatus(t('toolbar.sideTaskFailed'))
        console.error('dsh-select-quote: side task failed', error)
      },
    )
  }, [hide, sending, sideModel, sideText])

  const handleSideKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        hide()
        return
      }
      // Enter and the Cmd/Ctrl chord both submit, exactly like the host
      // composer's gesture; Shift+Enter is the browser's own line break and is
      // left alone. This textarea lives outside the host composer, so neither
      // surface sees the other's Enter.
      const gesture = popoverEnter(event.nativeEvent)
      if (gesture === 'submit') {
        event.preventDefault()
        sendSide()
      }
    },
    [hide, sendSide],
  )

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
          openLinkSnapshot(snapshot)
          return
        case 'copy':
          void copySnapshot(snapshot)
          return
        case 'add':
          beginComment(snapshot)
          return
        case 'handoff': {
          const defaultTarget = handoffDirectory.defaultTarget
          if (surface === 'menu') {
            const menu = menuRef.current
            openPicker(snapshot, menu ? { x: menu.x, y: menu.y } : undefined)
          } else if (defaultTarget) {
            beginHandoff(snapshot, defaultTarget)
          } else {
            openPicker(snapshot)
          }
          return
        }
        case 'translate':
          beginTranslate(snapshot)
          return
        case 'side':
          openSide(snapshot)
      }
    },
    [
      beginComment,
      beginHandoff,
      beginTranslate,
      copySnapshot,
      handoffDirectory,
      openLinkSnapshot,
      openPicker,
      openSide,
    ],
  )

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

  const handleCommentKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (phase === 'handoff') {
          cancelHandoff()
          return
        }
        // Explicit cancel discards the optional comment text;
        // the annotation itself stays saved.
        pendingIdRef.current = null
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
          if (!handoffBusy) commitHandoff(false)
        } else if (comment.trim()) {
          finishComment(true)
        }
      }
    },
    [comment, commitHandoff, finishComment, handoffBusy, hide, phase],
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
  const actions: SelectionActionEntry[] = selectionActions(
    active,
    handoffOptions,
    visibilityFor(active.text),
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
        sideText={sideText}
        sending={sending}
        sideRef={sideRef}
        sideModelPicker={
          sideDirectory ? (
            <ModelSelect
              directory={sideDirectory}
              value={sideModel}
              onChange={setSideModel}
            />
          ) : undefined
        }
        toolbarStyle={toolbarStyle}
        toolbarRef={toolbarRef}
        commentWrapRef={commentWrapRef}
        commentRef={commentRef}
        menuOpen={menu !== null}
        onToolbarPointerDown={handleToolbarPointerDown}
        onCommentChange={setComment}
        onCommentKeyDown={handleCommentKeyDown}
        onFinishComment={finishComment}
        onCloseSheet={closeCommentSheet}
        onSideChange={handleSideChange}
        onSideKeyDown={handleSideKeyDown}
        onSendSide={sendSide}
        onCancelSide={hide}
        onHandoffPick={() => {
          const menu = menuRef.current
          openPicker(active, menu ? { x: menu.x, y: menu.y } : undefined)
        }}
        handoff={
          phase === 'handoff'
            ? {
                targetName: handoffTarget ? targetName(handoffTarget) : '',
                targetMeta: handoffTarget?.workspaceTitle ?? '',
                busy: handoffBusy,
                error: handoffError,
                onChangeTarget: () => openPicker(active),
                onPut: () => commitHandoff(false),
                onPutAndOpen: () => commitHandoff(true),
                onCancel: cancelHandoff,
              }
            : null
        }
        translate={
          phase === 'translate'
            ? {
                target: translateTarget,
                state: translation ?? { status: 'pending' },
                copied: translateCopied,
                onTarget: changeTranslateTarget,
                onCopy: copyTranslation,
                onRetry: retryTranslation,
                onStop: hide,
                onClose: closeTranslation,
              }
            : null
        }
      />
      {picker ? (
        <SessionTargetPicker
          directory={picker.directory}
          selectedId={picker.selectedId}
          x={picker.x}
          y={picker.y}
          touch={touch}
          onPick={pickHandoffTarget}
          onClose={() => setPicker(null)}
        />
      ) : null}
      {menu ? (
        <SelectionMenu
          entries={selectionActions(
            menu.snapshot,
            handoffOptions,
            visibilityFor(menu.snapshot.text),
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
