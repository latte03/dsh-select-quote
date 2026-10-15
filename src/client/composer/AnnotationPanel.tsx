import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { jsx } from 'react/jsx-runtime'
import { composerCardOf } from '../dom/composer-host.ts'
import { scrollToAnnotation } from '../dom/scrollToAnnotation.ts'
import {
  annotationTitle,
  bindAnnotationSession,
  clearAnnotations,
  getAnnotations,
  removeAnnotation,
  subscribeAnnotations,
  updateAnnotationComment,
  type SelectionAnnotation,
} from '../state/annotation-store.ts'
import { ensureToolbarStyles, A, cx, styles } from '../styles.ts'
import {
  DRAFT_MARKER,
  stripDraftMarker,
  withDraftMarker,
} from '../protocol/quote-protocol.ts'
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
 * True while an IME composition is in flight.
 *
 * Composition events bubble, so a capture listener on the document sees them
 * wherever the composer lives. Anything that writes the draft must check this:
 * replacing editor content mid-composition drops the composing text.
 */
function useComposing(): MutableRefObject<boolean> {
  const composing = useRef(false)
  useEffect(() => {
    const onStart = (): void => {
      composing.current = true
    }
    const onEnd = (): void => {
      composing.current = false
    }
    document.addEventListener('compositionstart', onStart, true)
    document.addEventListener('compositionend', onEnd, true)
    return () => {
      document.removeEventListener('compositionstart', onStart, true)
      document.removeEventListener('compositionend', onEnd, true)
    }
  }, [])
  return composing
}

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
  const composing = useComposing()
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
    bindAnnotationSession(sessionId)
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

  // Reconcile the invisible marker with the annotation list. The host persists
  // the draft — marker included — so a refresh used to come back with an orphan
  // U+200B and no annotations: an empty-looking composer with a live send
  // button. Both directions are idempotent with useDraftMarker's own write.
  //
  // Never write while an IME composition is in flight: the host store's draft
  // goes transiently empty when composition starts (the composing text is not
  // in it yet), and a programmatic setDraft at that moment replaces the editor
  // content — the first pinyin character disappears. Composition ends, the
  // committed text lands as a draft change, and this runs again.
  useEffect(() => {
    if (composing.current) return
    if (items.length === 0) {
      if (draft.includes(DRAFT_MARKER)) setDraft(stripDraftMarker(draft))
      return
    }
    if (!draft.includes(DRAFT_MARKER) && draft.trim() === '') setDraft(withDraftMarker(draft))
  }, [items, draft, setDraft, composing])

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
