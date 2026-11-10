/**
 * Where a hover tip sits relative to the button that raised it.
 *
 * Centred on the anchor, not left-aligned like a menu: a tip belongs to one
 * small icon and reads wrong hanging off its corner. Prefers the side with more
 * room, keeps a margin from the viewport edge, and never leaves the box — the
 * tip is portaled to <body> (the toolbar itself is clipped by the transcript
 * scroller), so the viewport is the only bound that matters.
 */

/** Distance between the anchor and the tip. */
const GAP = 8
/** Smallest distance kept from the viewport edge. */
const MARGIN = 8

export interface TipAnchor {
  readonly top: number
  readonly left: number
  readonly width: number
  readonly height: number
}

export interface TipBounds {
  readonly top: number
  readonly left: number
  readonly right: number
  readonly bottom: number
}

export interface TipSize {
  readonly width: number
  readonly height: number
}

export interface TipPlacement {
  readonly top: number
  readonly left: number
  /** Which side of the anchor the tip ended up on; drives its entrance direction. */
  readonly side: 'top' | 'bottom'
}

export function placeTip(anchor: TipAnchor, size: TipSize, bounds: TipBounds): TipPlacement {
  const spaceAbove = anchor.top - bounds.top
  const spaceBelow = bounds.bottom - (anchor.top + anchor.height)
  const needed = size.height + GAP
  // Above by default (the row sits under the selection); drop below only when
  // there is genuinely more room there.
  const side: 'top' | 'bottom' =
    spaceAbove >= needed || spaceAbove >= spaceBelow ? 'top' : 'bottom'

  const centeredLeft = anchor.left + anchor.width / 2 - size.width / 2
  const maxLeft = Math.max(bounds.left + MARGIN, bounds.right - size.width - MARGIN)
  const left = Math.min(Math.max(centeredLeft, bounds.left + MARGIN), maxLeft)

  const rawTop =
    side === 'top' ? anchor.top - size.height - GAP : anchor.top + anchor.height + GAP
  const top = Math.min(
    Math.max(rawTop, bounds.top + MARGIN),
    Math.max(bounds.top + MARGIN, bounds.bottom - size.height - MARGIN),
  )

  return { top, left, side }
}
