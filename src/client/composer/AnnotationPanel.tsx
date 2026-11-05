import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { composerCardOf } from '../dom/composer-host.ts'
import { scrollToAnnotation } from '../dom/scrollToAnnotation.ts'
import { t } from '../i18n.ts'
import { isSessionArchived, openSourceAndLocate, sessionTitleOf } from '../selection/navigation.ts'
import { showToast } from '../ui/toast.ts'
import {
  annotationTitle,
  bindAnnotationSession,
  clearAnnotations,
  getAnnotations,
  removeAnnotation,
  restoreAnnotations,
  subscribeAnnotations,
  updateAnnotationComment,
  type SelectionAnnotation,
} from '../state/annotation-store.ts'
import { ensureToolbarStyles, A, cx, styles } from '../styles.ts'
import { handoffMarkIdOf } from '../state/handoff.ts'
import {
  ANNOTATIONS_BLOCK_OPEN,
  readComposedDraft,
} from '../protocol/annotation-protocol.ts'
import {
  DRAFT_MARKER,
  stripDraftMarker,
} from '../protocol/quote-protocol.ts'
import { AnnotationSummary, type AnnotationSummaryItem } from '../ui/AnnotationCardView.tsx'
import { isMarkerOnly } from './useDraftMarker.ts'
import { writeDraft, type InputActionsFace } from './draft-write.ts'
import { useSendIntercept } from './useSendIntercept.ts'

export interface AnnotationPanelProps {
  useInput: <T>(selector: (state: { draft: string; draftRev: number }) => T) => T
  inputActions: InputActionsFace
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
  const [items, setItems] =   useState<readonly SelectionAnnotation[]>(EMPTY)
  const stackRef = useRef<HTMLDivElement | null>(null)
  const draftRef = useRef(draft)
  const actionsRef = useRef(inputActions)
  const sessionRef = useRef(sessionId)
  const foldingRef = useRef(false)
  const composing = useComposing()
  draftRef.current = draft
  actionsRef.current = inputActions
  sessionRef.current = sessionId

  const setDraft = useCallback((text: string) => {
    // Never a blind `setDraft`: on dsh 0.2.2 the composer is a Lexical editor
    // whose `setDraft` clears the document, which would drop a quote the user
    // put in first. The draft we were handed is the current one; the helper
    // rewrites it in place whenever the host offers an append-only verb.
    selfWrites.current += 1
    writeDraft(actionsRef.current, text, draftRef.current)
  }, [])

  /**
   * Bumped whenever this component rewrites the draft itself.
   *
   * The rewind path below treats *any* draft carrying a complete protocol
   * block as a withdrawn message and lifts its annotations back into the
   * pending list. The host publishes every programmatic write as a normal
   * draft change, so without this counter the plugin's own write would be read
   * back as a rewind. The restore records the stamp it ran at and bails when
   * the draft it is looking at was produced by a later self-write.
   */
  const selfWrites = useRef(0)
  /** Stamp of the newest self-write the rewind path has already accounted for. */
  const seenSelfWrite = useRef(0)

  const sync = useCallback(() => {
    setItems(getAnnotations(sessionId))
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

  useSendIntercept({
    itemCount: items.length,
    draftRef,
    actionsRef,
    sessionId,
    onSelfWrite: () => {
      selfWrites.current += 1
    },
    onFolded: () => setItems(EMPTY),
    foldingRef,
  })

  // dsh-rewind refills a withdrawn message verbatim, protocol block included
  // (it reads the durable text blocks and writes them into the composer). Undo
  // that fold here: put the annotations back into the pending summary and the
  // user's own words back into the editor, so a rewind lands on the same state
  // the message was composed from instead of a wall of JSON.
  //
  // Runs only when a COMPLETE block is present, and never for the block this
  // plugin just folded at the send gesture — a draft that merely mentions the
  // markers is left alone. `foldingRef` clears as soon as the folded draft is
  // gone from the editor (sent and cleared, or replaced by this restore).
  useLayoutEffect(() => {
    if (!draft.includes(ANNOTATIONS_BLOCK_OPEN)) {
      foldingRef.current = false
      return
    }
    if (foldingRef.current || composing.current) return
    // A draft this component produced (marker reconcile, send fold) is never a
    // rewind — reading it back is what resurrected a card the user had just
    // deleted.
    if (seenSelfWrite.current === selfWrites.current) return
    const restored = readComposedDraft(draft)
    if (restored === null) return
    foldingRef.current = true
    seenSelfWrite.current = selfWrites.current
    restoreAnnotations(sessionId, restored.annotations)
    setDraft(restored.rest)
  }, [draft, sessionId, setDraft, composing])

  // Strip the legacy invisible marker from a persisted draft.
  //
  // The plugin used to append U+200B so an annotation-only draft counted as
  // non-empty and the Host's send button stayed enabled. That enabled sending a
  // message with no words — and since the bubble is now Host-rendered, such a
  // message shows as an empty bubble, which reads as a rendering bug. The
  // marker is no longer written; this pass only cleans drafts persisted before
  // the change, and the composer keeps its own placeholder because the draft is
  // genuinely empty again.
  //
  // Never write while an IME composition is in flight: the host store's draft
  // goes transiently empty when composition starts (the composing text is not
  // in it yet), and a programmatic write at that moment replaces the editor
  // content — the first pinyin character disappears.
  useEffect(() => {
    if (composing.current) return
    if (!draft.includes(DRAFT_MARKER)) return
    setDraft(isMarkerOnly(draft) ? '' : stripDraftMarker(draft))
  }, [draft, setDraft, composing])

  const onRemoveAll = useCallback(() => {
    clearAnnotations(sessionId, 'discarded')
    setItems(EMPTY)
  }, [])

  const dropIfEmpty = useCallback(() => {
    setItems(getAnnotations(sessionId))
  }, [])

  const onItemSelect = useCallback((index: number, item: AnnotationSummaryItem) => {
    scrollToAnnotation(index + 1, item.text, item.id)
  }, [])

  const onItemRemove = useCallback((_index: number, item: AnnotationSummaryItem) => {
    if (item.id) {
      removeAnnotation(sessionId, item.id)
    } else {
      // Fallback: drop by text match.
      const current = getAnnotations(sessionId)
      const hit = current.find((entry) => entry.text === item.text)
      if (hit) removeAnnotation(sessionId, hit.id)
    }
    dropIfEmpty()
  }, [dropIfEmpty])

  const onItemEdit = useCallback((_index: number, item: AnnotationSummaryItem, comment: string) => {
    const id = item.id ?? getAnnotations(sessionId).find((entry) => entry.text === item.text)?.id
    if (!id) return
    updateAnnotationComment(sessionId, id, comment)
    sync()
  }, [sync])

  /**
   * "From: <source>" opens the source conversation and flashes its arrow mark.
   * A cross-session item has no mark in THIS transcript by design, so this is
   * the only jump; nothing is searched by text here.
   */
  const onItemOrigin = useCallback((_index: number, item: AnnotationSummaryItem) => {
    const origin = item.origin
    if (!origin) return
    const live = sessionTitleOf(origin.sessionId, origin.title)
    if (isSessionArchived(origin.sessionId)) {
      showToast(t('handoff.archived', { title: live }))
      return
    }
    const entry = getAnnotations(sessionId).find((candidate) => candidate.id === item.id)
    const handoffId = origin.handoffId ?? entry?.origin?.handoffId
    openSourceAndLocate({
      sessionId: origin.sessionId,
      text: entry?.text ?? item.text,
      ...(entry ? { sources: entry.sources } : {}),
      ...(handoffId ? { markId: handoffMarkIdOf(handoffId) } : {}),
    })
  }, [])

  if (!sessionId || items.length === 0) return null

  return (
    <div ref={stackRef} className={cx(A.col, styles.cardStack)}>
      <AnnotationSummary
        count={items.length}
        items={items.map((item) => ({
          id: item.id,
          title: annotationTitle(item),
          text: item.text,
          comment: item.comment,
          ...(item.origin
            ? {
                origin: {
                  sessionId: item.origin.sessionId,
                  title: sessionTitleOf(item.origin.sessionId, item.origin.title),
                  archived: isSessionArchived(item.origin.sessionId),
                  ...(item.origin.handoffId ? { handoffId: item.origin.handoffId } : {}),
                },
              }
            : {}),
        }))}
        onRemoveAll={onRemoveAll}
        onItemSelect={onItemSelect}
        onItemRemove={onItemRemove}
        onItemEdit={onItemEdit}
        onItemOrigin={onItemOrigin}
      />
    </div>
  )
}

/** Alias kept for overlay registration. */
export const QuoteCard = AnnotationPanel
