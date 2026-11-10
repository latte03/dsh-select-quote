/**
 * Paint-only halves of the selection UI: the anchored desktop toolbar/popover
 * and the touch bottom bar/sheet. All state, persistence and placement stay in
 * `SelectionToolbar`; this module owns markup, portals and ARIA only.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
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
import { HoverTip, type TipTarget } from '../ui/HoverTip.tsx'
import { LucideIcon } from '../ui/icons.tsx'
import { Kbd } from '../ui/Kbd.tsx'
import type { VisualViewportMetrics } from '../ui/touch.ts'
import type { SelectionAction, SelectionActionEntry, SelectionLabelPart } from './actions.ts'
import { LanguageMenu } from './LanguageMenu.tsx'
import { SplitLabel } from './SplitLabel.tsx'
import type { TranslationActions } from './translation-view.ts'
import type { SelectionPhase } from './useSelectionWatcher.ts'

const LANGUAGE_OPTIONS = TRANSLATE_LANGUAGES.map((code) => ({
  value: code,
  label: LANGUAGE_LABELS[code],
}))

/** Controller state for the cross-session handoff panel (no writes yet). */
export interface HandoffPanelActions {
  readonly targetName: string
  readonly targetMeta: string
  readonly busy: boolean
  readonly error: string | null
  onChangeTarget(): void
  onPut(): void
  onPutAndOpen(): void
  onCancel(): void
}

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
  /** Icon-only row: the toolbar is wider than the space it floats over. */
  readonly compact?: boolean
  /** Opens the destination picker behind an entry's chevron. */
  readonly onDestinations?: (
    action: SelectionActionEntry,
    at?: { x: number; y: number },
  ) => void
  /** Jumps to this plugin's settings page (the row's trailing gear). */
  readonly onSettings?: () => void
  /** Present only while the handoff phase owns the surface. */
  readonly handoff?: HandoffPanelActions | null
  /** Present only while the translate phase owns the surface. */
  readonly translate?: TranslationActions | null
}

/** Plain wording of a cell, for the icon-only (compact) button's label. */
function labelTextOf(cell: ActionCell): string {
  if (cell.parts !== undefined) return cell.parts.map((part) => part.text).join('')
  return cell.label ?? cell.action.label
}

/** One painted button: an entry itself, or one of its destinations. */
interface ActionCell {
  readonly id: string
  readonly action: SelectionActionEntry
  /** Destination wording; absent for the entry's own button. */
  readonly label: string | null
  /** Split wording for the destination name (accent segment). */
  readonly parts?: readonly SelectionLabelPart[]
  readonly onClick: (() => void) | undefined
  /** First cell of an entry, which is what a divider separates. */
  readonly starts: boolean
  /** Paint the destinations behind a chevron instead of as extra cells. */
  readonly chevron: boolean
}

/**
 * One row of action buttons. Exported because the Host's merged selection pill
 * (`HostQuoteSurface`) paints the same row inside its own container.
 *
 * An entry that carries destinations is a split control: the button runs the
 * entry itself (for 批注 that means "stay in the conversation being read") and
 * the chevron opens everywhere else the passage can go. The touch bar has no
 * chevron — vertical space is free and a menu would only cost a tap — so each
 * destination becomes a row of its own.
 */
export function ActionRow({
  actions,
  stacked,
  compact = false,
  onDestinations,
  onSettings,
}: {
  actions: readonly SelectionActionEntry[]
  stacked: boolean
  /** Icon-only cells: the row is wider than the space it floats over. */
  compact?: boolean
  /** Opens the destination picker of a split entry (its chevron). */
  onDestinations?: (action: SelectionActionEntry, at?: { x: number; y: number }) => void
  /** Jumps to this plugin's settings; the gear is the row's last button. */
  onSettings?: () => void
}): ReactNode {
  /**
   * Icon-only cells have no visible wording, so the label rides a hover tip.
   * One tip for the whole row: a per-button tip would let two of them stack while
   * the pointer crosses the gap between cells.
   */
  const [tip, setTip] = useState<TipTarget | null>(null)
  const openTip = useCallback((element: HTMLElement, text: string): void => {
    const rect = element.getBoundingClientRect()
    setTip({ text, rect })
  }, [])
  const closeTip = useCallback((): void => setTip(null), [])

  const cells: ActionCell[] = []
  for (const action of actions) {
    const destinations = action.destinations ?? []
    cells.push({
      id: action.key,
      action,
      label: null,
      ...(action.labelParts === undefined ? {} : { parts: action.labelParts }),
      onClick: action.onClick,
      starts: true,
      chevron: !stacked && destinations.length > 0 && onDestinations !== undefined,
    })
    if (!stacked) continue
    for (const destination of destinations) {
      cells.push({
        id: `${action.key}:${destination.key}`,
        action,
        label: destination.label,
        ...(destination.labelParts === undefined ? {} : { parts: destination.labelParts }),
        onClick: () => action.pick?.(destination.key),
        starts: false,
        chevron: false,
      })
    }
  }
  const row = cells.map((cell, index) => (
    <Fragment key={cell.id}>
      {!stacked && !compact && index > 0 && cell.starts ? (
        <span className={styles.divider} aria-hidden="true" />
      ) : null}
      <button
        type="button"
        className={cx(
          A.plain,
          stacked ? A.col : A.inlineRow,
          stacked ? styles.touchAction : styles.button,
          compact && !stacked && cx(A.gridMid, styles.buttonCompact),
        )}
        aria-label={compact && !stacked ? labelTextOf(cell) : undefined}
        aria-haspopup={cell.chevron ? 'dialog' : undefined}
        // aria-disabled rather than `disabled`: a disabled button drops hover
        // in some browsers, and the tooltip is the whole point here. Clicks
        // are ignored below instead.
        aria-disabled={cell.action.disabled ? 'true' : undefined}
        data-dsq-tip={cell.action.disabled ? cell.action.disabledReason : undefined}
        data-dsq-destinations={cell.chevron ? 'true' : undefined}
        // No `title`: the platform tip would surface a second, slower label
        // after ours. The tip carries the disabled reason when there is one.
        onPointerEnter={
          compact && !stacked
            ? (event) =>
                openTip(
                  event.currentTarget,
                  cell.action.disabled
                    ? (cell.action.disabledReason ?? labelTextOf(cell))
                    : labelTextOf(cell),
                )
            : undefined
        }
        onPointerLeave={compact && !stacked ? closeTip : undefined}
        onFocus={
          compact && !stacked
            ? (event) => openTip(event.currentTarget, labelTextOf(cell))
            : undefined
        }
        onBlur={compact && !stacked ? closeTip : undefined}
        onPointerDown={compact && !stacked ? closeTip : undefined}
        onClick={cell.action.disabled ? undefined : cell.onClick}
      >
        <LucideIcon name={cell.action.icon} size={stacked ? 18 : 14} />
        {compact && !stacked ? null : stacked ? (
          <span>{cell.parts ? <SplitLabel parts={cell.parts} /> : (cell.label ?? cell.action.label)}</span>
        ) : cell.parts ? (
          <SplitLabel parts={cell.parts} />
        ) : (
          cell.label ?? cell.action.label
        )}
      </button>
      {cell.chevron ? (
        <button
          type="button"
          className={cx(
            A.plain,
            A.gridMid,
            styles.handoffChevron,
            // Icon-only in both layouts: one square, one icon size.
            styles.iconCell,
          )}
          aria-haspopup="dialog"
          aria-label={t('handoff.dialogAria')}
          data-dsq-destinations-picker="true"
          onPointerEnter={
            compact && !stacked
              ? (event) => openTip(event.currentTarget, t('handoff.dialogAria'))
              : undefined
          }
          onPointerLeave={compact && !stacked ? closeTip : undefined}
          onFocus={
            compact && !stacked
              ? (event) => openTip(event.currentTarget, t('handoff.dialogAria'))
              : undefined
          }
          onBlur={compact && !stacked ? closeTip : undefined}
          onClick={(event) => {
            event.stopPropagation()
            const rect = event.currentTarget.getBoundingClientRect()
            onDestinations?.(cell.action, { x: rect.left, y: rect.bottom })
          }}
        >
          <LucideIcon name="chevron-down" size={14} />
        </button>
      ) : null}
    </Fragment>
  ))
  return (
    <>
      {row}
      {onSettings === undefined ? null : (
        <>
          {!stacked && cells.length > 0 ? (
            <span className={styles.divider} aria-hidden="true" />
          ) : null}
          <button
            type="button"
            className={cx(
              A.plain,
              stacked ? A.col : A.inlineRow,
              stacked ? styles.touchAction : styles.button,
              // The gear is icon-only in every layout: it takes the same square
              // as the cells beside it instead of the text row's padding.
              !stacked && cx(A.gridMid, styles.iconCell),
            )}
            aria-label={t('toolbar.settings')}
            data-dsq-settings="true"
            onPointerEnter={(event) => openTip(event.currentTarget, t('toolbar.settings'))}
            onPointerLeave={closeTip}
            onFocus={(event) => openTip(event.currentTarget, t('toolbar.settings'))}
            onBlur={closeTip}
            onClick={onSettings}
          >
            <LucideIcon name="settings" size={stacked ? 18 : 14} />
            {stacked ? <span>{t('toolbar.settings')}</span> : null}
          </button>
        </>
      )}
      <HoverTip target={tip} />
    </>
  )
}

/** Handoff phase: target chip, optional comment, 放入 / 放入并前往. */
function HandoffPanel({
  handoff,
  comment,
  touch,
  commentRef,
  onChange,
  onKeyDown,
}: {
  handoff: HandoffPanelActions
  comment: string
  touch: boolean
  commentRef: MutableRefObject<HTMLTextAreaElement | null>
  onChange: (value: string) => void
  onKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void
}): ReactNode {
  const { busy } = handoff
  return (
    <>
      <div className={styles.handoffChip}>
        <span className={styles.handoffChipLabel}>{t('handoff.targetLabel')}</span>
        <span className={styles.handoffChipTitle} title={handoff.targetName}>
          {handoff.targetName}
        </span>
        <button
          type="button"
          className={styles.handoffChange}
          onClick={handoff.onChangeTarget}
          disabled={busy}
        >
          {t('handoff.change')}
        </button>
      </div>
      <div className={styles.handoffHint}>{t('handoff.hint')}</div>
      <CommentField
        comment={comment}
        touch={touch}
        commentRef={commentRef}
        onChange={onChange}
        onKeyDown={onKeyDown}
      />
      {handoff.error ? (
        <div className={styles.handoffError} role="alert">
          {handoff.error}
        </div>
      ) : null}
      <div className={cx(A.row, styles.commentActions, touch && styles.touchActions)}>
        <button
          type="button"
          className={cx(A.plain, A.inlineRow, styles.button, touch && styles.touchSecondary)}
          disabled={busy}
          onClick={handoff.onCancel}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className={cx(A.plain, A.inlineRow, styles.button)}
          disabled={busy}
          onClick={handoff.onPut}
        >
          {busy ? t('handoff.putting') : t('handoff.put')}
        </button>
        <button
          type="button"
          className={cx(A.plain, A.inlineRow, styles.button, styles.buttonAddComment)}
          disabled={busy}
          onClick={handoff.onPutAndOpen}
        >
          {busy ? t('handoff.putting') : t('handoff.putAndOpen')}
        </button>
      </div>
    </>
  )
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
            className={cx(A.plain, A.gridMid, styles.translateCopy)}
            aria-label={translate.copied ? t('translate.copied') : t('translate.copy')}
            title={translate.copied ? t('translate.copied') : t('translate.copy')}
            data-copied={translate.copied ? 'true' : undefined}
            onClick={translate.onCopy}
          >
            <LucideIcon name={translate.copied ? 'check' : 'copy'} size={16} />
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
  compact,
  onDestinations,
  onSettings,
  handoff,
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
            <ActionRow actions={actions} stacked compact={compact} onDestinations={onDestinations} onSettings={onSettings} />
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
                  : phase === 'handoff'
                    ? t('handoff.dialogAria')
                    : phase === 'translate'
                      ? t('translate.title')
                      : t('sideTask.title')
              }
            >
              <div className={cx(A.row, styles.touchSheetHead)}>
                <span className={styles.touchSheetTitle}>
                  {phase === 'comment'
                    ? t('toolbar.commentHint')
                    : phase === 'handoff'
                      ? t('handoff.commentTitle')
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
              ) : phase === 'handoff' && handoff ? (
                <HandoffPanel
                  handoff={handoff}
                  comment={comment}
                  touch={touch}
                  commentRef={commentRef}
                  onChange={onCommentChange}
                  onKeyDown={onCommentKeyDown}
                />
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
            <LucideIcon name="circle-alert" size={13} className={styles.statusIcon} />
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
            <ActionRow actions={actions} stacked={false} compact={compact} onDestinations={onDestinations} onSettings={onSettings} />
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
                : phase === 'handoff'
                  ? t('handoff.commentTitle')
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
              : phase === 'handoff'
                ? t('handoff.dialogAria')
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
          ) : phase === 'handoff' && handoff ? (
            <HandoffPanel
              handoff={handoff}
              comment={comment}
              touch={touch}
              commentRef={commentRef}
              onChange={onCommentChange}
              onKeyDown={onCommentKeyDown}
            />
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
          <LucideIcon name="circle-alert" size={13} className={styles.statusIcon} />
          {status}
        </div>
      ) : null}
    </>,
    active.layer.host,
  )
}
