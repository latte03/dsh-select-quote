import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { jsx } from 'react/jsx-runtime'
import { composerCardOf } from '../dom/composer-host.ts'
import { scrollToAnnotation } from '../dom/scrollToAnnotation.ts'
import { setRuntimeSession } from '../runtime.ts'
import {
  annotationTitle,
  clearAnnotations,
  getAnnotations,
  removeAnnotation,
  subscribeAnnotations,
  updateAnnotationComment,
  type SelectionAnnotation,
} from '../state/annotation-store.ts'
import { ensureToolbarStyles, A, cx, styles } from '../styles.ts'
import { AnnotationSummary, type AnnotationSummaryItem } from '../ui/AnnotationCardView.tsx'
import { clearDraftMarker, useDraftMarker } from './useDraftMarker.ts'
import { useSendIntercept } from './useSendIntercept.ts'

export interface AnnotationPanelProps {
  useInput: <T>(selector: (state: { draft: string; draftRev: number }) => T) => T
  inputActions: {
    setDraft(text: string): void
  }
  sessionId?: string
}

const EMPTY: readonly SelectionAnnotation[] = []

/**
 * Composer annotation summary (`conversation.input.overlay`).
 *
 * Pending selections never enter the editor as text: the summary card is the
 * only affordance, and the JSON protocol block is folded into the draft one
 * capture-phase step before the composer's own send handler reads it.
 */
export function AnnotationPanel({
  useInput,
  inputActions,
  sessionId,
}: AnnotationPanelProps): ReactNode {
  const draft = useInput((state) => state.draft)
  const [items, setItems] = useState<readonly SelectionAnnotation[]>(EMPTY)
  const stackRef = useRef<HTMLDivElement | null>(null)
  const draftRef = useRef(draft)
  const actionsRef = useRef(inputActions)
  const sessionRef = useRef(sessionId)
  draftRef.current = draft
  actionsRef.current = inputActions
  sessionRef.current = sessionId

  const setDraft = useCallback((text: string) => {
    actionsRef.current.setDraft(text)
  }, [])

  const sync = useCallback(() => {
    setItems(getAnnotations())
  }, [])

  useEffect(() => {
    if (sessionId) setRuntimeSession(sessionId)
  }, [sessionId])

  useEffect(() => {
    ensureToolbarStyles()
    sync()
    return subscribeAnnotations(sync)
  }, [sync, sessionId])

  // Reserve draft height under the absolute summary (1/5-width card).
  useEffect(() => {
    const element = stackRef.current
    if (!element) return
    const card = composerCardOf(element)
    if (!card) return
    const apply = (): void => {
      card.style.setProperty('--dsq-quote-pad', `${element.offsetHeight + 16}px`)
    }
    card.classList.add(styles.cardPad)
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(element)
    return () => {
      observer.disconnect()
      card.classList.remove(styles.cardPad)
      card.style.removeProperty('--dsq-quote-pad')
    }
  }, [items])

  useDraftMarker({ itemCount: items.length, draftRef, setDraft })
  useSendIntercept({
    itemCount: items.length,
    draftRef,
    setDraft,
    onFolded: () => setItems(EMPTY),
  })

  const onRemoveAll = useCallback(() => {
    clearAnnotations()
    setItems(EMPTY)
    clearDraftMarker(draftRef.current, setDraft)
  }, [setDraft])

  const dropIfEmpty = useCallback(() => {
    setItems(getAnnotations())
    if (getAnnotations().length === 0) clearDraftMarker(draftRef.current, setDraft)
  }, [setDraft])

  const onItemSelect = useCallback((index: number, item: AnnotationSummaryItem) => {
    scrollToAnnotation(index + 1, item.text, item.id)
  }, [])

  const onItemRemove = useCallback((_index: number, item: AnnotationSummaryItem) => {
    if (item.id) {
      removeAnnotation(undefined, item.id)
    } else {
      // Fallback: drop by text match.
      const current = getAnnotations()
      const hit = current.find((entry) => entry.text === item.text)
      if (hit) removeAnnotation(undefined, hit.id)
    }
    dropIfEmpty()
  }, [dropIfEmpty])

  const onItemEdit = useCallback((_index: number, item: AnnotationSummaryItem, comment: string) => {
    const id = item.id ?? getAnnotations().find((entry) => entry.text === item.text)?.id
    if (!id) return
    updateAnnotationComment(undefined, id, comment)
    sync()
  }, [sync])

  if (!sessionId || items.length === 0) return null

  return jsx('div', {
    ref: stackRef,
    className: cx(A.col, styles.cardStack),
    children: jsx(AnnotationSummary, {
      count: items.length,
      items: items.map((item) => ({
        id: item.id,
        title: annotationTitle(item),
        text: item.text,
        comment: item.comment,
      })),
      onRemoveAll,
      onItemSelect,
      onItemRemove,
      onItemEdit,
    }),
  })
}

/** Alias kept for overlay registration. */
export const QuoteCard = AnnotationPanel
