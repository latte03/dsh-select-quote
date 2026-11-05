/**
 * Translate popover flow: target resolution, one streaming request, cache, copy
 * feedback and the popover's own placement/keys/focus. The toolbar owns the
 * selection surface and calls `reset()` whenever it closes.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react'
import { getConfig } from '../config.ts'
import { clearNativeSelection, copyText, type SelectionSnapshot } from '../dom/selection.ts'
import { activeLocale, t } from '../i18n.ts'
import { runtime } from '../runtime.ts'
import {
  MAX_TRANSLATE_CHARS,
  resolveTranslatePrompt,
  resolveTranslateTarget,
  type TranslateLanguage,
} from '../translate.ts'
import { readTranslation, writeTranslation } from '../translate-cache.ts'
import type { TranslationState } from './translation-view.ts'
import type { SelectionPhase } from './useSelectionWatcher.ts'

export interface TranslatePopoverInput {
  readonly sessionId?: string
  readonly activeRef: MutableRefObject<SelectionSnapshot | null>
  readonly phase: SelectionPhase
  readonly touch: boolean
  readonly commentWrapRef: MutableRefObject<HTMLElement | null>
  /** Re-places the popover; it grows while the translation streams in. */
  readonly placeCommentPop: () => void
  readonly hide: () => void
  readonly setStatus: (value: string | null) => void
  readonly setActive: (snapshot: SelectionSnapshot) => void
  readonly dismissMenu: () => boolean
  readonly setPhase: (phase: SelectionPhase) => void
}

export function useTranslatePopover(input: TranslatePopoverInput) {
  const {
    sessionId,
    activeRef,
    phase,
    touch,
    commentWrapRef,
    placeCommentPop,
    hide,
    setStatus,
    setActive,
    dismissMenu,
    setPhase,
  } = input
  const [translation, setTranslation] = useState<TranslationState | null>(null)
  const [target, setTarget] = useState<TranslateLanguage>('en')
  const [copied, setCopied] = useState(false)
  /** Invalidates a late response after close, stop, or a new target. */
  const runRef = useRef(0)
  /** Aborts the host call and its stream when the surface or target changes. */
  const controllerRef = useRef<AbortController | null>(null)
  const copiedTimerRef = useRef<number | null>(null)

  /** Run one translation; a later attempt invalidates and aborts this stream. */
  const request = useCallback(
    (snapshot: SelectionSnapshot, nextTarget: TranslateLanguage) => {
      const run = runtime.translate
      controllerRef.current?.abort()
      controllerRef.current = null
      const generation = ++runRef.current
      setCopied(false)
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
        target: nextTarget,
        provider: settings.translateProvider.trim(),
        model: settings.translateModel.trim(),
        prompt: resolveTranslatePrompt(settings.translatePrompt, nextTarget),
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
      controllerRef.current = controller
      setTranslation({ status: 'pending' })
      void run(snapshot, nextTarget, controller.signal, (event) => {
        if (generation !== runRef.current) return
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
          if (generation === runRef.current) controllerRef.current = null
        },
        (error) => {
          if (generation !== runRef.current || controller.signal.aborted) return
          controllerRef.current = null
          const detail = error instanceof Error ? error.message : String(error)
          console.error('dsh-select-quote: translation failed', {
            target: nextTarget,
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
  const begin = useCallback(
    (snapshot: SelectionSnapshot) => {
      const nextTarget = resolveTranslateTarget(
        snapshot.text,
        getConfig().translateTarget,
        activeLocale(),
      )
      setStatus(null)
      setActive(snapshot)
      dismissMenu()
      setPhase('translate')
      setTarget(nextTarget)
      request(snapshot, nextTarget)
    },
    [dismissMenu, request, setActive, setPhase, setStatus],
  )

  const changeTarget = useCallback(
    (nextTarget: TranslateLanguage) => {
      const snapshot = activeRef.current
      if (!snapshot) return
      setTarget(nextTarget)
      // The same live config the settings page edits: the next selection and
      // the settings row both start from this pick.
      runtime.setConfigField?.('translateTarget', nextTarget)
      request(snapshot, nextTarget)
    },
    [activeRef, request],
  )

  const copy = useCallback(() => {
    if (translation?.status !== 'done' || translation.text === undefined) return
    void copyText(translation.text).then(
      () => {
        setCopied(true)
        if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current)
        copiedTimerRef.current = window.setTimeout(() => {
          copiedTimerRef.current = null
          setCopied(false)
        }, 1600)
      },
      () => setStatus(t('toolbar.copyFailed')),
    )
  }, [setStatus, translation])

  const retry = useCallback(() => {
    const snapshot = activeRef.current
    if (snapshot) request(snapshot, target)
  }, [activeRef, request, target])

  const close = useCallback(() => {
    clearNativeSelection()
    hide()
  }, [hide])

  /** Drop the stream and its UI; the caller owns when the surface closes. */
  const reset = useCallback(() => {
    runRef.current += 1
    controllerRef.current?.abort()
    controllerRef.current = null
    if (copiedTimerRef.current !== null) {
      window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = null
    }
    setTranslation(null)
    setCopied(false)
  }, [])

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
  }, [phase, schedulePlace, target, translation])

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
  }, [commentWrapRef, phase, touch])

  return { translation, target, copied, begin, changeTarget, copy, retry, close, reset }
}
