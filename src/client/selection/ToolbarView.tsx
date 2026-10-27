/**
 * Paint-only halves of the selection UI: the anchored desktop toolbar/popover
 * and the touch bottom bar/sheet. All state, persistence and placement stay in
 * `SelectionToolbar`; this module owns markup, portals and ARIA only.
 */

import {
  Fragment,
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
import { LucideIcon } from '../ui/icons.tsx'
import type { VisualViewportMetrics } from '../ui/touch.ts'
import type { SelectionActionEntry } from './actions.ts'
import type { SelectionPhase } from './useSelectionWatcher.ts'

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

/** Submit gesture painted on the accent buttons; touch has no keyboard hint. */
function ShortcutHint(): ReactNode {
  return (
    <kbd className={styles.buttonKey} title="Enter" aria-hidden="true">
      Enter
    </kbd>
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
        {touch ? null : <ShortcutHint />}
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
            {touch || sending ? null : <ShortcutHint />}
          </button>
        </div>
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
              aria-label={t('toolbar.commentDialogAria')}
            >
              <div className={cx(A.row, styles.touchSheetHead)}>
                <span className={styles.touchSheetTitle}>
                  {phase === 'comment' ? t('toolbar.commentHint') : t('sideTask.title')}
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
              ) : (
                <SideQuote text={active.text} />
              )}
              {phase === 'comment' ? (
                <>
                  {commentField}
                  {commentActions}
                </>
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
              {phase === 'comment' ? t('toolbar.commentHint') : t('sideTask.title')}
            </span>
          </div>
        </div>
      )}
      {!menuOpen && phase !== 'idle' ? (
        <div
          ref={commentWrapRef}
          className={cx(A.col, styles.commentPop, phase === 'side' && styles.commentPopSide)}
          role="dialog"
          aria-label={
            phase === 'comment' ? t('toolbar.commentDialogAria') : t('sideTask.title')
          }
          onPointerDown={onToolbarPointerDown}
        >
          {phase === 'comment' ? (
            <>
              {commentField}
              {commentActions}
            </>
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
