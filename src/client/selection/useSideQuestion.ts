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
import { getAnnotations, removeAnnotation } from '../state/annotation-store.ts'
import { selectionKeyOf } from '../state/handoff.ts'
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

/**
 * Remove the pending draft annotations that stand for this selection.
 *
 * A pending item carries every source the selection resolved to; the side send
 * carries the same locator. Matching on `selectionKeyOf` keeps two annotations
 * of identical text from different messages apart, and falls back to plain text
 * when the snapshot has no locator (the selection missed the transcript model).
 */
export function consumeQuote(
  target: {
    readonly text: string
    readonly source?: SelectionSnapshot['source']
  },
  sessionId?: string,
): void {
  const source = target.source
  const wanted = selectionKeyOf(
    target.text,
    source === undefined
      ? undefined
      : {
          text: target.text,
          messageId: source.messageId,
          startOffset: source.startOffset,
          endOffset: source.endOffset,
        },
  )
  for (const item of getAnnotations(sessionId)) {
    const matches = item.sources.some((candidate) =>
      // A locator-less snapshot can only match on text.
      source === undefined
        ? candidate.text === target.text
        : selectionKeyOf(candidate.text, candidate) === wanted,
    )
    if (matches) removeAnnotation(sessionId, item.id)
  }
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
        // The quote just went out with the question, so the pending card that
        // stands for it must go too. `useSendIntercept` only watches the Host
        // composer's own send gesture, and this popover lives outside that
        // card — without this the card would linger and ride along with the
        // next ordinary message as a duplicate.
        consumeQuote(snapshot)
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
