/**
 * Seam between the Host's selection pill and this plugin's coordinator.
 *
 * Since dsh 0.2.2-rc.1 the pill next to a selection is the winner of the keyed
 * slot `conversation.chat.text-interaction`, painted by the chat view, and the
 * Host hands that entry only `trigger` / `readText` / `dismiss` /
 * `clearSelection` (see `TextInteractionSurface`). That tree is not ours, so it
 * cannot read the coordinator's state directly.
 *
 * This module is the single crossing point: `SelectionToolbar` publishes a
 * dispatcher while it is mounted, the pill asks it for the action row, and
 * nothing else — no React context, no prop drilling, no duplicated action
 * table — travels between the two surfaces.
 */

import type { SelectionSnapshot } from '../dom/selection.ts'
import type { SelectionActionEntry } from './actions.ts'

export interface HostSurfaceBridge {
  /**
   * The entries the floating toolbar would show for this snapshot, in the same
   * order, with the same handlers. Built by the coordinator so the pill cannot
   * drift from the toolbar's labels, availability rules or handoff options.
   */
  actions(snapshot: SelectionSnapshot): readonly SelectionActionEntry[]
  /**
   * Open the destination list of one split entry at a viewport point. The pill
   * paints the chevron but not the list: the coordinator owns the menu slot, so
   * the list inherits its latch, its dismissal rules and its placement.
   */
  destinations(
    snapshot: SelectionSnapshot,
    action: SelectionActionEntry,
    at?: { x: number; y: number },
  ): void
}

let current: HostSurfaceBridge | null = null
let hostDismiss: (() => void) | null = null

/**
 * The mounted pill's own dismiss, so a flow started from its row can close it.
 * Without this the pill would stay on screen while our comment popover or the
 * target picker takes over the same spot.
 */
export function publishHostDismiss(dismiss: (() => void) | null): void {
  hostDismiss = dismiss
}

export function dismissHostPill(): void {
  hostDismiss?.()
}

/** Publish the mounted coordinator's bridge; the disposer only clears its own. */
export function publishHostSurface(bridge: HostSurfaceBridge): () => void {
  current = bridge
  return () => {
    if (current === bridge) current = null
  }
}

/** The live bridge, or null while no coordinator is mounted. */
export function hostSurface(): HostSurfaceBridge | null {
  return current
}
