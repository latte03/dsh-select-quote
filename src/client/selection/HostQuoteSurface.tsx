/**
 * The Host's selection pill, rendered by us.
 *
 * `conversation.chat.text-interaction` is a keyed slot: the Host's chat view
 * paints whichever entry wins the cell, and a keyed cell is decided by
 * `priority` — the lowest number renders, and two entries may not share a
 * priority. The shipped `message-quotes` plugin registers key `quote` at the
 * default priority 0, so registering the same key below it takes the surface
 * over. There is no way to sit *next to* the Host's button: a second entry for
 * the same key has to outrank it and then paint everything itself.
 *
 * So this component paints both halves: the quote button the Host used to
 * paint (same behaviour — read the selection, insert a `QuoteNode`, clear and
 * dismiss) and, when `mergeHostSurface` is on, this plugin's own action row.
 * The row is not rebuilt here: it is asked for from the mounted coordinator
 * through `host-surface.ts`, so labels, availability and handoff options stay
 * identical to the floating toolbar's.
 *
 * Registration is unconditional because a slot entry cannot be added or
 * removed at runtime; `mergeHostSurface` decides what the pill contains, and
 * with it off the pill is a faithful stand-in for the Host's own button.
 */

import { useCallback, useSyncExternalStore, type ReactNode } from 'react'
import { getConfig, subscribeConfig } from '../config.ts'
import { readSelectionSnapshot } from '../dom/selection.ts'
import { t } from '../i18n.ts'
import { A, cx, styles } from '../styles.ts'
import { LucideIcon } from '../ui/icons.tsx'
import type { SelectionActionEntry } from './actions.ts'
import { hostSurface } from './host-surface.ts'
import { guardSurfacePress } from './pointer-guard.ts'
import { ActionRow } from './ToolbarView.tsx'

/** The slice of the Host's `inputActions` this surface inserts through. */
interface HostSurfaceInputActions {
  /** dsh 0.2.2-rc.1+; absent on older hosts, which never dispatch this pill. */
  insertQuote?(text: string): boolean
}

/**
 * Props the Host assembles for this slot: the owner supplies the gesture data,
 * the session scope supplies `inputActions`. Everything is optional so a host
 * change degrades to the quote button instead of an exception — an entry that
 * throws is abdicated, and the cell would fall back to the Host's own button
 * anyway.
 */
export interface HostQuoteSurfaceProps {
  trigger?: 'selection' | 'contextmenu'
  readText?: () => string | null
  dismiss?: () => void
  clearSelection?: () => void
  inputActions?: HostSurfaceInputActions
}

export function HostQuoteSurface({
  readText,
  dismiss,
  clearSelection,
  inputActions,
}: HostQuoteSurfaceProps): ReactNode {
  const config = useSyncExternalStore(subscribeConfig, getConfig, getConfig)

  // The pill mounts once per gesture, while the selection it dispatched on is
  // still live (the Host reads the same range on click), so the snapshot can be
  // read during this render. `null` as the toolbar root asks for the selection
  // without excluding our own layer: in merged mode our toolbar is suppressed,
  // but a right-click menu may still be on screen.
  const snapshot = readSelectionSnapshot(null)
  const bridge = config.mergeHostSurface ? hostSurface() : null
  const actions = snapshot !== null && bridge !== null ? bridge.actions(snapshot) : []
  // Our own phases (comment, translate, side question, hand-off picker) open
  // their own surface. The Host pill does not know about them and never
  // dismisses on its own, so every action the row runs has to close it, or two
  // surfaces would sit on top of each other. The native selection is left
  // alone: the flows measure and save it themselves.
  const entries: readonly SelectionActionEntry[] = actions.map((entry) => ({
    ...entry,
    onClick: () => {
      entry.onClick()
      dismiss?.()
    },
  }))

  const quote = useCallback(() => {
    const text = readText?.() ?? null
    if (text === null) {
      dismiss?.()
      return
    }
    if (inputActions?.insertQuote?.(text) !== true) return
    clearSelection?.()
    dismiss?.()
  }, [readText, dismiss, clearSelection, inputActions])

  return (
    <div className={styles.hostPill} onPointerDown={guardSurfacePress}>
      <button
        type="button"
        className={cx(A.plain, A.inlineRow, styles.button)}
        onClick={quote}
      >
        <LucideIcon name="quote" size={14} className={styles.pillQuote} />
        {t('toolbar.quote')}
      </button>
      {entries.length > 0 ? (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <ActionRow actions={entries} stacked={false} />
        </>
      ) : null}
    </div>
  )
}
