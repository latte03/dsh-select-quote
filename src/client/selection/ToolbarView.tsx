/**
 * Paint-only halves of the selection UI: the anchored desktop toolbar/popover
 * and the touch bottom bar/sheet. All state, persistence and placement stay in
 * `SelectionToolbar`; this module owns markup, portals and ARIA only.
 */

import {
  Fragment,
  useEffect,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import type { SelectionSnapshot } from '../dom/selection.ts'
import { t } from '../i18n.ts'
import { A, cx, styles } from '../styles.ts'
import { LANGUAGE_LABELS, TRANSLATE_LANGUAGES } from '../translate.ts'
import { LucideIcon } from '../ui/icons.tsx'
import { Kbd } from '../ui/Kbd.tsx'
import type { VisualViewportMetrics } from '../ui/touch.ts'
import type { SelectionActionEntry } from './actions.ts'
import { LanguageMenu } from './LanguageMenu.tsx'
import type { TranslationActions } from './translation-view.ts'
import type { SelectionPhase } from './useSelectionWatcher.ts'

const LANGUAGE_OPTIONS = TRANSLATE_LANGUAGES.map((code) => ({
  value: code,
  label: LANGUAGE_LABELS[code],
}))

export interface ToolbarViewProps {
  readonly touch: boolean
  readonly phase: SelectionPhase
  readonly active: SelectionSnapshot
  readonly status: string | null
  readonly viewport: VisualViewportMetrics
  readonly actions: readonly SelectionActionEntry[]
  readonly comment: string
  /** Question typed into the side-task composer. */
  readonly sideText: string
  readonly sending: boolean
  readonly sideRef: MutableRefObject<HTMLTextAreaElement | null>
  /** Model seat for the side-task child; absent when the shell has no catalog. */
  readonly sideModelPicker?: ReactNode
  /** The right-click menu owns the surface; only status may remain. */
  readonly menuOpen: boolean
  readonly toolbarStyle: CSSProperties
  readonly toolbarRef: MutableRefObject<HTMLDivElement | null>
  readonly commentWrapRef: MutableRefObject<HTMLDivElement | null>
  readonly commentRef: MutableRefObject<HTMLTextAreaElement | null>
  readonly onToolbarPointerDown: (event: ReactPointerEvent<HTMLElement>) => void
  readonly onCommentChange: (value: string) => void
  readonly onCommentKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void
  readonly onFinishComment: (keepComment: boolean) => void
  readonly onCloseSheet: () => void
  readonly onSideChange: (value: string) => void
  readonly onSideKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void
  readonly onSendSide: () => void
  readonly onCancelSide: () => void
  /** Present only while the translate phase owns the surface. */
  readonly translate?: TranslationActions | null
}

function ActionRow({
  actions,
  stacked,
}: {
  actions: readonly SelectionActionEntry[]
  stacked: boolean
}): ReactNode {
  return actions.map((action, index) => (
    <Fragment key={action.key}>
      {!stacked && index > 0 ? <span className={styles.divider} aria-hidden="true" /> : null}
      <button
        type="button"
        className={cx(
          A.plain,
          stacked ? A.col : A.inlineRow,
          stacked ? styles.touchAction : styles.button,
        )}
        onClick={action.onClick}
      >
        <LucideIcon name={action.icon} size={stacked ? 18 : 14} />
        {stacked ? <span>{action.label}</span> : action.label}
      </button>
    </Fragment>
  ))
}

function CommentField({
  comment,
  touch,
  commentRef,
  onChange,
  onKeyDown,
}: {
  comment: string
  touch: boolean
  commentRef: MutableRefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void
}): ReactNode {
  return (
    <textarea
      ref={commentRef}
      className={cx(A.box, styles.commentInput, touch && styles.touchComment)}
      placeholder={t('common.commentPlaceholder')}
      value={comment}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}

function CommentActions({
  comment,
  touch,
  onFinishComment,
}: {
  comment: string
  touch: boolean
  onFinishComment: (keepComment: boolean) => void
}): ReactNode {
  return (
    <div className={cx(A.row, styles.commentActions, touch && styles.touchActions)}>
      <button
        type="button"
        className={cx(A.plain, A.inlineRow, styles.button, touch && styles.touchSecondary)}
        onClick={() => onFinishComment(false)}
      >
        {t('toolbar.skipComment')}
      </button>
      <button
        type="button"
        className={cx(A.plain, A.inlineRow, styles.button, styles.buttonAddComment)}
        disabled={!comment.trim()}
        aria-keyshortcuts="Enter"
        onClick={() => onFinishComment(true)}
      >
        {t('toolbar.addComment')}
        {touch ? null : <Kbd />}
      </button>
    </div>
  )
}

/** The referenced passage painted as the plugin's own annotation block. */
function SideQuote({ text }: { text: string }): ReactNode {
  return (
    <div
      className={cx(A.row, styles.summary, styles.sideQuote)}
      title={text}
      data-dsq-side-quote="true"
    >
      <div className={cx(A.keep, A.gridMid, styles.summaryIcon)} aria-hidden="true">
        1
      </div>
      <div className={cx(A.grow, styles.summaryBody)}>
        <div className={styles.summaryTitle}>{t('common.selectedText')}</div>
        <div className={styles.sideQuoteText}>{text}</div>
      </div>
    </div>
  )
}

function SideComposer({
  quote,
  value,
  sending,
  touch,
  sideRef,
  modelPicker,
  onChange,
  onKeyDown,
  onSend,
  onCancel,
}: {
  quote?: string
  value: string
  sending: boolean
  touch: boolean
  sideRef: MutableRefObject<HTMLTextAreaElement | null>
  modelPicker?: ReactNode
  onChange: (value: string) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onCancel: () => void
}): ReactNode {
  return (
    <>
      {quote ? <SideQuote text={quote} /> : null}
      <textarea
        ref={sideRef}
        className={cx(A.box, styles.commentInput)}
        placeholder={t('sideTask.placeholder')}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className={cx(A.row, styles.sideFooter)}>
        <div className={A.grow}>{modelPicker}</div>
        <div className={cx(A.row, styles.commentActions)}>
          <button
            type="button"
            className={cx(A.plain, A.inlineRow, styles.button)}
            onClick={onCancel}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className={cx(A.plain, A.inlineRow, styles.button, styles.buttonAddComment)}
            disabled={!value.trim() || sending}
            aria-keyshortcuts="Enter"
            onClick={onSend}
          >
            {sending ? t('sideTask.sending') : t('sideTask.send')}
            {touch || sending ? null : <Kbd />}
          </button>
        </div>
      </div>
    </>
  )
}

/** One-line reminder of what is being translated; the full text stays selected. */
function TranslateQuote({ text }: { text: string }): ReactNode {
  return (
    <div
      className={styles.translateQuote}
      title={text}
      dir="auto"
      data-dsq-selectable="true"
    >
      {text}
    </div>
  )
}

/** Agent-progress cells: a 3×3 grid pulsing in a diagonal sweep. */
const PROGRESS_DELAYS = [0, 0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 0.98, 1.12]

function ProgressGrid(): ReactNode {
  return (
    <span className={styles.progressGrid} aria-hidden="true">
      {PROGRESS_DELAYS.map((delay, index) => (
        <span
          key={index}
          className={styles.progressCell}
          style={{ animationDelay: `${delay}s` }}
        />
      ))}
    </span>
  )
}

function TranslatePanel({
  translate,
  touch = false,
  quote,
}: {
  translate: TranslationActions
  touch?: boolean
  /** The referenced passage, painted between the mode row and the result. */
  quote?: ReactNode
}): ReactNode {
  const { state } = translate
  const bodyRef = useRef<HTMLDivElement | null>(null)
  const reasoning = state.reasoning?.trim() ?? ''
  const liveReasoning =
    state.status === 'pending' && state.text === undefined && reasoning.length > 0
  // Follow the growing text until it reaches the body's own scroll cap.
  useEffect(() => {
    if (state.status !== 'pending') return
    const body = bodyRef.current
    if (body !== null) body.scrollTop = body.scrollHeight
  }, [state.status, state.text, state.reasoning])
  const message =
    state.status === 'pending'
      ? state.thinking
        ? t('translate.thinking')
        : t('translate.pending')
      : state.status === 'tooLong'
        ? t('translate.tooLong')
        : state.status === 'unavailable'
          ? t('translate.unavailable')
          : state.status === 'error'
            ? t('translate.failed')
            : null

  return (
    <>
      <div className={cx(A.row, styles.translateHead)}>
        <span className={styles.translateTargetLabel}>{t('translate.target')}</span>
        <LanguageMenu
          value={translate.target}
          options={LANGUAGE_OPTIONS}
          ariaLabel={t('translate.target')}
          onChange={translate.onTarget}
        />
        <span className={A.grow} />
        {touch ? null : (
          <button
            type="button"
            className={cx(A.plain, A.gridMid, styles.translateClose)}
            aria-label={t('common.close')}
            onClick={translate.onClose}
          >
            <LucideIcon name="x" size={16} />
          </button>
        )}
      </div>
      {quote}
      <div
        ref={bodyRef}
        className={cx(A.col, styles.translateBody)}
        data-dsq-selectable="true"
        aria-live={state.status === 'done' || state.status === 'error' ? 'polite' : 'off'}
        aria-busy={state.status === 'pending'}
      >
        {reasoning.length > 0 && !liveReasoning ? (
          <details className={styles.translateReasoning}>
            <summary className={styles.translateReasoningSummary}>
              <LucideIcon
                name="chevron-right"
                size={12}
                className={styles.translateReasoningChevron}
              />
              <span>{t('translate.reasoning')}</span>
            </summary>
            <div className={styles.translateReasoningText}>{reasoning}</div>
          </details>
        ) : null}
        {state.text !== undefined ? (
          <div className={styles.translateText} dir="auto">
            {state.text}
            {state.status === 'pending' ? (
              <span className={styles.translateCaret} aria-hidden="true" />
            ) : null}
          </div>
        ) : null}
        {state.status === 'pending' && state.text === undefined ? (
          <div
            className={cx(A.row, styles.translateHint, styles.translateLoading)}
            role="status"
          >
            <ProgressGrid />
            <span className={styles.translateShimmer}>{message}</span>
          </div>
        ) : state.status === 'tooLong' ||
          state.status === 'unavailable' ||
          state.status === 'error' ? (
          <>
            <div className={styles.translateHint} role="status">
              {message}
            </div>
            {state.status === 'error' && state.error ? (
              <div className={styles.translateError} title={state.error}>
                {state.error}
              </div>
            ) : null}
          </>
        ) : null}
        {liveReasoning ? (
          <div className={cx(styles.translateReasoningText, styles.translateReasoningLive)}>
            {reasoning}
            <span className={styles.translateCaret} aria-hidden="true" />
          </div>
        ) : null}
      </div>
      <div className={cx(A.row, styles.translateActions)}>
        {state.status === 'done' ? (
          <button
            type="button"
            className={cx(A.plain, A.inlineRow, styles.button, styles.buttonAddComment)}
            onClick={translate.onCopy}
          >
            {translate.copied ? t('translate.copied') : t('translate.copy')}
          </button>
        ) : state.status === 'pending' ? (
          <button
            type="button"
            className={cx(A.plain, A.inlineRow, styles.button)}
            onClick={translate.onStop}
          >
            {t('translate.stop')}
          </button>
        ) : state.status === 'error' ? (
          <button
            type="button"
            className={cx(A.plain, A.inlineRow, styles.button, styles.buttonAddComment)}
            onClick={translate.onRetry}
          >
            {t('translate.retry')}
          </button>
        ) : null}
      </div>
    </>
  )
}

export function ToolbarView({
  touch,
  phase,
  active,
  status,
  viewport,
  actions,
  comment,
  sideText,
  sending,
  sideRef,
  sideModelPicker,
  menuOpen,
  toolbarStyle,
  toolbarRef,
  commentWrapRef,
  commentRef,
  onToolbarPointerDown,
  onCommentChange,
  onCommentKeyDown,
  onFinishComment,
  onCloseSheet,
  onSideChange,
  onSideKeyDown,
  onSendSide,
  onCancelSide,
  translate,
}: ToolbarViewProps): ReactNode {
  const commentField = (
    <CommentField
      comment={comment}
      touch={touch}
      commentRef={commentRef}
      onChange={onCommentChange}
      onKeyDown={onCommentKeyDown}
    />
  )
  const commentActions = (
    <CommentActions comment={comment} touch={touch} onFinishComment={onFinishComment} />
  )

  if (touch) {
    // A fixed bottom bar and a sheet, both outside the transcript layer: on a
    // phone the anchored toolbar competes with the OS selection menu, and the
    // anchored popover ends up under the soft keyboard. Content coordinates do
    // not help there, so this path rides the visual viewport instead.
    const bottom = `calc(${viewport.inset}px + 8px + env(safe-area-inset-bottom, 0px))`
    return createPortal(
      <>
        {phase === 'idle' ? (
          <div
            ref={toolbarRef}
            className={cx(A.row, styles.touchBar)}
            style={{ bottom }}
            role="toolbar"
            aria-label={t('toolbar.aria')}
            data-dsq-toolbar="true"
            data-touch="true"
            onPointerDown={onToolbarPointerDown}
          >
            <ActionRow actions={actions} stacked />
          </div>
        ) : null}
        {phase !== 'idle' ? (
          <>
            <div className={styles.touchScrim} aria-hidden="true" />
            <div
              ref={commentWrapRef}
              className={cx(A.col, styles.touchSheet)}
              style={{
                bottom,
                maxHeight: `${Math.max(240, Math.round(viewport.height * 0.72))}px`,
              }}
              role="dialog"
              aria-label={
                phase === 'comment'
                  ? t('toolbar.commentDialogAria')
                  : phase === 'translate'
                    ? t('translate.title')
                    : t('sideTask.title')
              }
            >
              <div className={cx(A.row, styles.touchSheetHead)}>
                <span className={styles.touchSheetTitle}>
                  {phase === 'comment'
                    ? t('toolbar.commentHint')
                    : phase === 'translate'
                      ? t('translate.title')
                      : t('sideTask.title')}
                </span>
                <button
                  type="button"
                  className={cx(A.plain, A.gridMid, styles.touchSheetClose)}
                  aria-label={t('common.close')}
                  onClick={onCloseSheet}
                >
                  <LucideIcon name="x" size={18} />
                </button>
              </div>
              {phase === 'comment' ? (
                <div className={styles.touchQuote}>{active.text}</div>
              ) : phase === 'translate' ? null : (
                <SideQuote text={active.text} />
              )}
              {phase === 'comment' ? (
                <>
                  {commentField}
                  {commentActions}
                </>
              ) : phase === 'translate' && translate ? (
                <TranslatePanel
                  translate={translate}
                  touch
                  quote={
                    <div className={styles.touchQuote} data-dsq-selectable="true">
                      {active.text}
                    </div>
                  }
                />
              ) : (
                <SideComposer
                  value={sideText}
                  sending={sending}
                  touch={touch}
                  sideRef={sideRef}
                  modelPicker={sideModelPicker}
                  onChange={onSideChange}
                  onKeyDown={onSideKeyDown}
                  onSend={onSendSide}
                  onCancel={onCancelSide}
                />
              )}
            </div>
          </>
        ) : null}
        {status ? (
          <div
            className={styles.touchStatus}
            style={{ bottom: `calc(${viewport.inset}px + 72px + env(safe-area-inset-bottom, 0px))` }}
            role="status"
          >
            {status}
          </div>
        ) : null}
      </>,
      document.body,
    )
  }

  return createPortal(
    <>
      {menuOpen ? null : phase === 'idle' ? (
        <div
          ref={toolbarRef}
          className={cx(A.row, styles.toolbar)}
          style={toolbarStyle}
          role="toolbar"
          aria-label={t('toolbar.aria')}
          data-dsq-toolbar="true"
          data-anchor={active.below ? 'below' : 'above'}
          onPointerDown={onToolbarPointerDown}
        >
          <div className={cx(A.inlineRow, styles.toolbarInner)}>
            <ActionRow actions={actions} stacked={false} />
          </div>
        </div>
      ) : (
        <div
          ref={toolbarRef}
          className={cx(A.row, styles.toolbar)}
          role="toolbar"
          aria-label={t('toolbar.aria')}
          data-dsq-toolbar="true"
          data-anchor="popover-top"
          onPointerDown={onToolbarPointerDown}
        >
          <div className={cx(A.inlineRow, styles.toolbarInner)}>
            <span
              style={{ padding: '0 8px', fontSize: 13, opacity: 0.8, whiteSpace: 'nowrap' }}
            >
              {phase === 'comment'
                ? t('toolbar.commentHint')
                : phase === 'translate'
                  ? t('translate.title')
                  : t('sideTask.title')}
            </span>
          </div>
        </div>
      )}
      {!menuOpen && phase !== 'idle' ? (
        <div
          ref={commentWrapRef}
          className={cx(
            A.col,
            styles.commentPop,
            phase === 'side' && styles.commentPopSide,
            phase === 'translate' && styles.commentPopTranslate,
          )}
          role="dialog"
          aria-label={
            phase === 'comment'
              ? t('toolbar.commentDialogAria')
              : phase === 'translate'
                ? t('translate.title')
                : t('sideTask.title')
          }
          onPointerDown={onToolbarPointerDown}
        >
          {phase === 'comment' ? (
            <>
              {commentField}
              {commentActions}
            </>
          ) : phase === 'translate' && translate ? (
            <TranslatePanel
              translate={translate}
              quote={<TranslateQuote text={active.text} />}
            />
          ) : (
            <SideComposer
              quote={active.text}
              value={sideText}
              sending={sending}
              touch={touch}
              sideRef={sideRef}
              modelPicker={sideModelPicker}
              onChange={onSideChange}
              onKeyDown={onSideKeyDown}
              onSend={onSendSide}
              onCancel={onCancelSide}
            />
          )}
        </div>
      ) : null}
      {status ? (
        <div className={styles.status} style={toolbarStyle} role="status">
          {status}
        </div>
      ) : null}
    </>,
    active.layer.host,
  )
}
