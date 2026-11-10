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
 * So this component paints the whole pill: the quote button the Host used to
 * paint (same behaviour — read the selection, insert a `QuoteNode`, clear and
 * dismiss) as the first cell of the row, and, when `mergeHostSurface` is on,
 * this plugin's own actions after it. The row is not rebuilt here: it is asked
 * for from the mounted coordinator through `host-surface.ts`, so labels,
 * availability and handoff options stay identical to the floating toolbar's.
 *
 * Registration is unconditional because a slot entry cannot be added or
 * removed at runtime; `mergeHostSurface` decides what the pill contains, and
 * with it off the quote cell is the only one — a faithful stand-in for the
 * Host's own button.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { getConfig, subscribeConfig } from '../config.ts'
import { readSelectionSnapshot } from '../dom/selection.ts'
import { t } from '../i18n.ts'
import { styles } from '../styles.ts'
import { runtime } from '../runtime.ts'
import type { SelectionActionEntry } from './actions.ts'
import { hostSurface, publishHostDismiss } from './host-surface.ts'
import { shouldCompactRow } from './host-surface-fit.ts'
import { guardSurfacePress } from './pointer-guard.ts'
import { ActionRow } from './ToolbarView.tsx'

/**
 * The Host's Chat column — the box the surface is absolutely positioned in, and
 * therefore the width that actually constrains this row. Our own wrapper is
 * `width: max-content`, so it can never answer "is there room?".
 */
const CHAT_COLUMN = '[data-chat-flow]'

/** Gap kept from the column edge, matching the floating toolbar's inset. */
const COLUMN_INSET = 8

/** Room for the row, or 0 when the layout has not told us yet. */
function availableWidthFor(pill: HTMLElement): number {
  const column = pill.closest(CHAT_COLUMN)
  if (column instanceof HTMLElement && column.clientWidth > 0) {
    return column.clientWidth - COLUMN_INSET
  }
  // No column (an unexpected host, a detached surface): the viewport is the only
  // honest bound left, and a zero keeps the labels rather than collapsing.
  return window.innerWidth > 0 ? window.innerWidth - COLUMN_INSET * 4 : 0
}

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
  const pillRef = useRef<HTMLDivElement | null>(null)
  /** Width the row needs with its labels; only readable while they are painted. */
  const naturalWidthRef = useRef(0)
  const [compact, setCompact] = useState(false)
  /** Bumped when the column resizes, so the fit decision runs again. */
  const [spaceTick, setSpaceTick] = useState(0)

  // The pill mounts once per gesture, while the selection it dispatched on is
  // still live (the Host reads the same range on click), so the snapshot can be
  // read during this render. `null` as the toolbar root asks for the selection
  // without excluding our own layer: in merged mode our toolbar is suppressed,
  // but a right-click menu may still be on screen.
  const snapshot = readSelectionSnapshot(null)
  const bridge = config.mergeHostSurface ? hostSurface() : null
  const actions = snapshot !== null && bridge !== null ? bridge.actions(snapshot) : []

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

  /**
   * One row: the Host's quote cell, then our actions.
   *
   * The quote cell sits immediately before 批注 so the two "take this text"
   * actions read together; with merging off it is the only cell.
   *
   * Our own phases (comment, translate, side question, hand-off picker) open
   * their own surface. The Host pill does not know about them and never
   * dismisses on its own, so every cell closes it first, or two surfaces would
   * sit on top of each other. The native selection is left alone: the flows
   * measure and save it themselves.
   */
  const entries: readonly SelectionActionEntry[] = (() => {
    const cells: SelectionActionEntry[] = actions.map((entry) => ({
      ...entry,
      onClick: () => {
        entry.onClick()
        dismiss?.()
      },
    }))
    const quoteCell: SelectionActionEntry = {
      key: 'quote',
      icon: 'message-square-quote',
      label: t('toolbar.quote'),
      onClick: () => {
        quote()
        dismiss?.()
      },
    }
    const at = cells.findIndex((cell) => cell.key === 'annotate')
    return at < 0 ? [...cells, quoteCell] : [...cells.slice(0, at), quoteCell, ...cells.slice(at)]
  })()

  // The chevron's target picker is painted by the coordinator; the pill only
  // hands over the request. It stays open underneath, so the row does not look
  // like it closed the moment its chevron was pressed.
  const destinations = useCallback(
    (action: SelectionActionEntry, at?: { x: number; y: number }) => {
      if (snapshot === null) return
      bridge?.destinations(snapshot, action, at)
    },
    [bridge, snapshot],
  )

  // Published so a flow started from this row can close the pill; the Host owns
  // the surface and only this component holds its dismiss.
  useEffect(() => {
    publishHostDismiss(() => dismiss?.())
    return () => publishHostDismiss(null)
  }, [dismiss])

  /**
   * The Host caps its surface to the width of the column it floats over, and the
   * row does not shrink — so labels spill out of the pill instead of the pill
   * growing. When the natural row is wider than that box, drop to icons: each
   * cell keeps its tooltip and aria-label, and the destination chevron stays.
   *
   * Measure against the Chat column, never against our own wrapper: the Host
   * gives the surface `position: absolute; width: max-content`, so the wrapper's
   * width *is* the row's width and comparing the two says "does not fit" at
   * every column width — which is why every merged row used to collapse to
   * icons. The column is the box that actually constrains the surface.
   */
  useLayoutEffect(() => {
    const el = pillRef.current
    if (el === null) return
    if (!compact) naturalWidthRef.current = el.getBoundingClientRect().width
    const next = shouldCompactRow(naturalWidthRef.current, availableWidthFor(el))
    if (next !== compact) setCompact(next)
  }, [compact, spaceTick, entries.length])

  /**
   * Re-decide when the column changes width (split drag, window resize, sidebar
   * opening). The surface also mounts before a hidden pane reports a width, so
   * the observer's first callback is what lets the row settle either way.
   */
  useLayoutEffect(() => {
    const el = pillRef.current
    const column = el?.closest(CHAT_COLUMN)
    if (!(column instanceof HTMLElement)) return
    const observer = new ResizeObserver(() => setSpaceTick((tick) => tick + 1))
    observer.observe(column)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={pillRef} className={styles.hostPill} onPointerDown={guardSurfacePress}>
      <ActionRow
        actions={entries}
        stacked={false}
        compact={compact}
        onDestinations={destinations}
        // The gear belongs to our row: with merging off the pill is the Host's
        // own quote button and must not grow any of our chrome.
        {...(actions.length > 0
          ? {
              onSettings: () => {
                dismiss?.()
                runtime.openPluginSettings?.()
              },
            }
          : {})}
      />
    </div>
  )
}
