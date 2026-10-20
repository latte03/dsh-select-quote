/** Placement helpers for anchored popovers (hover list, comment pop). */

export interface PopoverPlacement {
  readonly top: number
  readonly left: number
  /** Vertical placement used for arrow/collision hints. */
  readonly side: 'bottom' | 'top'
}

const GAP = 8
const MARGIN = 8
const ESTIMATED_HEIGHT = 220

/** Visible area placement must stay inside (defaults to the viewport). */
export interface PlacementBounds {
  readonly top: number
  readonly left: number
  readonly right: number
  readonly bottom: number
}

/**
 * Place `panel` near `anchor`, flipping vertical side when the preferred side
 * lacks room. Keeps the panel inside `bounds` (the viewport by default).
 */
export function placePopover(
  anchor: DOMRect,
  panel: { width: number; height: number },
  preferred: 'bottom' | 'top' = 'bottom',
  gap: number = GAP,
  bounds?: PlacementBounds,
): PopoverPlacement {
  const box = bounds ?? { top: 0, left: 0, right: window.innerWidth, bottom: window.innerHeight }
  const spaceBelow = box.bottom - anchor.bottom
  const spaceAbove = anchor.top - box.top

  let side: 'bottom' | 'top' = preferred
  const need = panel.height + gap
  if (preferred === 'bottom' && spaceBelow < need && spaceAbove > spaceBelow) {
    side = 'top'
  } else if (preferred === 'top' && spaceAbove < need && spaceBelow > spaceAbove) {
    side = 'bottom'
  }

  const top =
    side === 'bottom'
      ? Math.min(anchor.bottom + gap, box.bottom - panel.height - MARGIN)
      : Math.max(anchor.top - panel.height - gap, box.top + MARGIN)

  const left = Math.min(
    Math.max(anchor.left, box.left + MARGIN),
    Math.max(box.left + MARGIN, box.right - panel.width - MARGIN),
  )

  return { top, left, side }
}

/** Estimate a panel size when it has not been measured yet. */
export function measurePanel(el: HTMLElement | null, fallbackHeight = ESTIMATED_HEIGHT) {
  if (!el) return { width: 280, height: fallbackHeight }
  const prev = el.style.display
  el.style.display = 'block'
  el.style.visibility = 'hidden'
  const rect = el.getBoundingClientRect()
  el.style.display = prev
  el.style.visibility = ''
  return {
    width: rect.width || 280,
    height: rect.height || fallbackHeight,
  }
}
