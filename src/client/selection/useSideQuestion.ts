/**
 * Side-question flow: the composer that asks a forked child about the quote,
 * its model seat and the send gesture. The transcript surface is the toolbar's;
 * this hook owns the question, its route and the host call.
 */

import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
} from 'react'
import { getConfig, subscribeConfig } from '../config.ts'
import { clearNativeSelection, type SelectionSnapshot } from '../dom/selection.ts'
import { t } from '../i18n.ts'
import type { ModelChoice } from '../model/types.ts'
import { runtime } from '../runtime.ts'
import { popoverEnter } from './popover-keys.ts'
import type { SelectionPhase } from './useSelectionWatcher.ts'

export interface SideQuestionInput {
  readonly phase: SelectionPhase
  readonly activeRef: MutableRefObject<SelectionSnapshot | null>
  readonly hide: () => void
  readonly setStatus: (value: string | null) => void
  readonly setActive: (snapshot: SelectionSnapshot) => void
  readonly dismissMenu: () => boolean
  readonly setPhase: (phase: SelectionPhase) => void
}

export function useSideQuestion(input: SideQuestionInput) {
  const { phase, activeRef, hide, setStatus, setActive, dismissMenu, setPhase } = input
  const [sideText, setSideText] = useState('')
  /** `null` follows the main conversation's route. */
  const [sideModel, setSideModel] = useState<ModelChoice | null>(null)
  const [sending, setSending] = useState(false)
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)

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

  /** Open the side-task composer for the latched quote. */
  const open = useCallback(
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
    [dismissMenu, setActive, setPhase, setStatus],
  )

  /**
   * Send the typed question to the client root, which asks the Host for a
   * fork-backed subagent and opens its conversation in the right sidebar.
   * The composer stays open (with the text) if the call fails.
   */
  const send = useCallback(() => {
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
  }, [activeRef, hide, sending, sideModel, sideText, setStatus])

  const onKeyDown = useCallback(
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
        send()
      }
    },
    [hide, send],
  )

  const reset = useCallback(() => {
    setSideText('')
    setSideModel(null)
    setSending(false)
  }, [])

  return {
    sideText,
    setSideText,
    sideModel,
    setSideModel,
    sideDirectory,
    sending,
    open,
    send,
    onKeyDown,
    reset,
  }
}
