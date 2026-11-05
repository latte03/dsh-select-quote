/**
 * Cross-session handoff flow: live target directory, the latched target, the
 * target picker, one write and navigation. Nothing is written until 放入 is
 * pressed, so opening the panel or the picker can always be dismissed cleanly.
 */

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type MutableRefObject,
} from 'react'
import { getConfig, resolveTriggers } from '../config.ts'
import { clearNativeSelection, type SelectionSnapshot } from '../dom/selection.ts'
import { t } from '../i18n.ts'
import { runtime, subscribeHandoffHost } from '../runtime.ts'
import { showToast } from '../ui/toast.ts'
import { putHandoff } from './handoff-actions.ts'
import { openConversation, sessionTitleOf } from './navigation.ts'
import {
  buildTargetDirectory,
  liveTitle,
  targetId,
  type SessionListSnapshot,
  type TargetDirectory,
  type TargetSession,
  type WorkspaceListSnapshot,
} from './session-targets.ts'
import type { SelectionPhase } from './useSelectionWatcher.ts'

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
export function targetName(target: TargetSession): string {
  return target.kind === 'new' ? t('handoff.newSession') : target.title
}

/** Latched picker; its directory is frozen while it is open. */
export interface PickerState {
  readonly snapshot: SelectionSnapshot
  readonly x: number
  readonly y: number
  readonly directory: TargetDirectory
  readonly selectedId?: string
}

export interface HandoffFlowInput {
  readonly activeSessionId?: string
  readonly activeRef: MutableRefObject<SelectionSnapshot | null>
  readonly comment: string
  readonly setComment: (value: string) => void
  readonly hide: () => void
  readonly touch: boolean
  readonly phaseRef: MutableRefObject<SelectionPhase>
  readonly dismissMenu: () => boolean
  readonly setStatus: (value: string | null) => void
  readonly setActive: (value: SelectionSnapshot | null) => void
  readonly setPhase: (phase: SelectionPhase) => void
}

export function useHandoffFlow(input: HandoffFlowInput) {
  const {
    activeSessionId,
    activeRef,
    comment,
    setComment,
    hide,
    touch,
    phaseRef,
    dismissMenu,
    setStatus,
    setActive,
    setPhase,
  } = input
  const [target, setTarget] = useState<TargetSession | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picker, setPicker] = useState<PickerState | null>(null)
  /** Mirrors `picker` for callbacks that must not depend on the render value. */
  const pickerRef = useRef<PickerState | null>(null)
  /** Comment typed for a handoff survives a cancel until it is committed. */
  const lastCommentRef = useRef<{ text: string; comment: string } | null>(null)
  const targetRef = useRef<TargetSession | null>(null)
  targetRef.current = target

  // The handoff host is published asynchronously by the workspace injection;
  // re-read it (and its snapshots) when it appears or a session changes.
  const host = useSyncExternalStore(
    subscribeHandoffHost,
    () => runtime.handoffHost,
    () => undefined,
  )
  const sessions = useSyncExternalStore(
    host ? host.subscribeSessions : NO_SUBSCRIBE,
    sessionsSnapshot,
    () => EMPTY_SESSIONS,
  )
  const workspaces = useSyncExternalStore(
    host ? host.subscribeWorkspaces : NO_SUBSCRIBE,
    workspacesSnapshot,
    () => EMPTY_WORKSPACES,
  )
  const directory: TargetDirectory = useMemo(
    () =>
      buildTargetDirectory({
        currentSessionId: activeSessionId,
        sessions: host ? sessions : undefined,
        workspaces: host ? workspaces : undefined,
      }),
    [activeSessionId, host, sessions, workspaces],
  )
  const options = useMemo(() => {
    const defaultTarget = directory.defaultTarget
    return {
      available: host !== undefined && directory.canHandoff,
      label: defaultTarget
        ? t('toolbar.handoffTo', { target: targetName(defaultTarget) })
        : t('toolbar.handoff'),
      ...(defaultTarget ? { targetName: targetName(defaultTarget) } : {}),
      menuLabel: t('handoff.menu'),
    }
  }, [directory, host])

  const updatePicker = useCallback((next: PickerState | null): void => {
    pickerRef.current = next
    setPicker(next)
  }, [])

  /** Latch one destination; used by both the initial flow and "change target". */
  const select = useCallback((next: TargetSession | null) => {
    setTarget(next)
    setBusy(false)
    setError(null)
  }, [])

  /** Remember the typed comment across a cancel, keyed by the selection text. */
  const remember = useCallback(
    (entry: { text: string; comment: string } | null) => {
      lastCommentRef.current = entry
    },
    [],
  )

  const rememberedComment = useCallback((text: string): string => {
    const kept = lastCommentRef.current
    return kept && kept.text === text ? kept.comment : ''
  }, [])

  /**
   * Freeze the target directory for the lifetime of the picker.
   *
   * The picker is `position: fixed`, so it must receive viewport coordinates.
   * The snapshot anchor is in content coordinates (it scrolls with the text);
   * a scrolled conversation would otherwise place the panel far off-screen.
   */
  const openPicker = useCallback(
    (snapshot: SelectionSnapshot, at?: { x: number; y: number }) => {
      const fromContent = snapshot.layer.fromContent(snapshot.left, snapshot.top)
      const point = at ?? { x: fromContent.left, y: fromContent.top }
      const current = targetRef.current
      updatePicker({
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
    [directory, updatePicker],
  )

  const closePicker = useCallback((): void => {
    updatePicker(null)
    // A picker opened from the menu replaced it; do not leave the auto toolbar
    // behind in contextmenu mode when it closes without a choice. During the
    // handoff comment step the pinned toolbar must stay for the user to finish.
    if (phaseRef.current === 'idle' && !touch && !resolveTriggers(getConfig()).auto) {
      setActive(null)
    }
  }, [phaseRef, setActive, touch, updatePicker])

  /**
   * Enter the handoff step for a latched quote. Nothing is written until 放入:
   * Escape or an outside press would otherwise leave a stray pending card.
   */
  const begin = useCallback(
    (snapshot: SelectionSnapshot, next: TargetSession | null) => {
      if (!next) return
      setStatus(null)
      setActive(snapshot)
      dismissMenu()
      select(next)
      setComment(rememberedComment(snapshot.text))
      setPhase('handoff')
    },
    [dismissMenu, rememberedComment, select, setActive, setComment, setPhase, setStatus],
  )

  const pick = useCallback(
    (next: TargetSession) => {
      updatePicker(null)
      if (phaseRef.current === 'handoff') {
        select(next)
        return
      }
      const latched = activeRef.current
      if (latched) begin(latched, next)
    },
    [activeRef, begin, phaseRef, select, updatePicker],
  )

  /** Dismiss the step; the typed comment is kept for the next attempt. */
  const cancel = useCallback(() => {
    const snapshot = activeRef.current
    remember(snapshot ? { text: snapshot.text, comment } : null)
    hide()
  }, [activeRef, comment, hide, remember])

  /** Resolve one target and write both sides; navigation only for 并前往. */
  const commit = useCallback(
    (go: boolean) => {
      const snapshot = activeRef.current
      const destination = targetRef.current
      const sourceId = activeSessionId
      if (!snapshot || !destination || !sourceId || busy) return
      setBusy(true)
      setError(null)
      void putHandoff({
        sourceSessionId: sourceId,
        sourceTitle: sessionTitleOf(sourceId, liveTitle(sessions.byId[sourceId], sourceId)),
        snapshot,
        target: destination,
        directory,
        comment,
      }).then(
        (outcome) => {
          setBusy(false)
          if (!outcome.ok || !outcome.targetId) {
            if (outcome.error) console.error('dsh-select-quote: handoff failed', outcome.error)
            setError(t('handoff.failed'))
            return
          }
          const name = targetName(destination)
          showToast(
            outcome.persisted === false
              ? `${t('handoff.doneNamed', { target: name })} · ${t('handoff.memoryOnly')}`
              : t('handoff.doneNamed', { target: name }),
          )
          lastCommentRef.current = null
          setTarget(null)
          setComment('')
          clearNativeSelection()
          hide()
          if (go && !openConversation(outcome.targetId)) {
            showToast(t('handoff.openFailed'))
          }
        },
        (failure) => {
          setBusy(false)
          console.error('dsh-select-quote: handoff failed', failure)
          setError(t('handoff.failed'))
        },
      )
    },
    [activeRef, activeSessionId, busy, comment, directory, hide, sessions, setComment],
  )

  const reset = useCallback(() => {
    setTarget(null)
    setBusy(false)
    setError(null)
    updatePicker(null)
  }, [updatePicker])

  return {
    directory,
    options,
    target,
    busy,
    error,
    picker,
    pickerRef,
    openPicker,
    closePicker,
    pick,
    begin,
    cancel,
    commit,
    reset,
  }
}
