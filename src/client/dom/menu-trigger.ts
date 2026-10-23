/**
 * Whether a `contextmenu` event should become the plugin's own selection menu.
 *
 * The native menu belongs to the transcript, not to us: another plugin, the
 * desktop shell, or the user's browser may already be showing something. We
 * only take the event when every fact below says the gesture was aimed at a
 * selection inside a conversation message, and nobody handled it first.
 */

export interface ContextMenuSignal {
  /** Another listener already called `preventDefault()` on this event. */
  defaultPrevented: boolean
  /** The right-click entry is enabled for the current trigger mode. */
  contextMenuEnabled: boolean
  /** Coarse pointers keep the bottom bar; there is no right-click there. */
  touch: boolean
  /** The event target lives in a conversation message. */
  targetInTranscript: boolean
  /** The pointer sits inside one of the selection's line boxes. */
  pointInSelection: boolean
  /** A non-collapsed selection exists right now. */
  hasSelection: boolean
}

export function shouldOpenSelectionMenu(signal: ContextMenuSignal): boolean {
  return (
    signal.contextMenuEnabled &&
    !signal.touch &&
    !signal.defaultPrevented &&
    signal.targetInTranscript &&
    signal.pointInSelection &&
    signal.hasSelection
  )
}

/** The subset of a DOMRect the point test needs. */
export interface PointRect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/**
 * True when `(x, y)` falls inside any of the selection's line boxes.
 *
 * The union box is wrong here: a short first line leaves empty space to its
 * right that belongs to no word, and a right-click there is not "on the
 * selection". Each line rect plus a small tolerance matches what the user sees.
 */
export function pointInRects(
  x: number,
  y: number,
  rects: Iterable<PointRect>,
  tolerance = 2,
): boolean {
  for (const rect of rects) {
    if (
      x >= rect.left - tolerance &&
      x <= rect.right + tolerance &&
      y >= rect.top - tolerance &&
      y <= rect.bottom + tolerance
    ) {
      return true
    }
  }
  return false
}
