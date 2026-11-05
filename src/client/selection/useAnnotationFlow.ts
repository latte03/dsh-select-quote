/**
 * Annotation comment flow ("add annotation" / host "add to task"). The quote is
 * saved the moment the step opens; the popover only edits that saved entry, so
 * dismissing it can never undo the annotation.
 */

import { useCallback, useRef, type MutableRefObject } from 'react'
import { focusComposer } from '../dom/composer-host.ts'
import { clearNativeSelection, type SelectionSnapshot } from '../dom/selection.ts'
import { saveAnnotation, updateAnnotationComment } from '../state/annotation-store.ts'
import type { SelectionPhase } from './useSelectionWatcher.ts'

export interface AnnotationFlowInput {
  readonly touch: boolean
  readonly commentRef: MutableRefObject<HTMLTextAreaElement | null>
  readonly hide: () => void
  readonly setStatus: (value: string | null) => void
  readonly setActive: (snapshot: SelectionSnapshot) => void
  readonly setComment: (value: string) => void
  readonly dismissMenu: () => boolean
  readonly setPhase: (phase: SelectionPhase) => void
}

export function useAnnotationFlow(input: AnnotationFlowInput) {
  const {
    touch,
    commentRef,
    hide,
    setStatus,
    setActive,
    setComment,
    dismissMenu,
    setPhase,
  } = input
  /** Annotation saved when the comment step opened; the box only edits it. */
  const pendingIdRef = useRef<string | null>(null)

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

  /** "Add annotation" is the commit: the quote is saved with or without text. */
  const begin = useCallback(
    (snapshot: SelectionSnapshot) => {
      pendingIdRef.current = saveSelection(snapshot)
      setActive(snapshot)
      dismissMenu()
      setPhase('comment')
      setComment('')
      setStatus(null)
    },
    [dismissMenu, saveSelection, setActive, setComment, setPhase, setStatus],
  )

  /**
   * Keep what was typed when the popover goes away without an explicit cancel;
   * the annotation itself was already saved, so dropping the text would also
   * lose the only optional part of the interaction.
   */
  const flush = useCallback(() => {
    const id = pendingIdRef.current
    pendingIdRef.current = null
    if (!id) return
    const typed = commentRef.current?.value ?? ''
    if (typed.trim()) updateAnnotationComment(undefined, id, typed)
  }, [commentRef])

  /** Close the optional comment step; the annotation stays saved either way. */
  const finish = useCallback(
    (keepComment: boolean) => {
      if (keepComment) flush()
      else pendingIdRef.current = null
      clearNativeSelection()
      hide()
      // On touch the sheet already covered the reader's place; opening the
      // composer keyboard on top of that is a second, unwanted jump.
      if (!touch) window.setTimeout(focusComposer, 16)
    },
    [flush, hide, touch],
  )

  /** Dismiss the sheet without discarding what was typed (outside click). */
  const closeSheet = useCallback(() => {
    flush()
    hide()
  }, [flush, hide])

  const reset = useCallback(() => {
    pendingIdRef.current = null
  }, [])

  return { begin, flush, finish, closeSheet, reset }
}
