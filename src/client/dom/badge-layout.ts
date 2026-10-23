/**
 * Collision layout for the ordinal badges that ride at the end of an
 * annotation mark.
 *
 * Badges are pseudo-elements anchored to the last fragment of their mark, so
 * two annotations ending at the same text offset produce identical anchors and
 * one badge paints over the other. This module resolves only the geometry; the
 * caller measures anchors and applies the returned offsets as CSS custom
 * properties, keeping the text flow untouched.
 */

export interface BadgeAnchor {
  /** Left edge of the badge at rest, viewport coordinates. */
  x: number
  /** Top edge of the badge at rest, viewport coordinates. */
  y: number
  width: number
  height: number
}

export interface BadgeOffset {
  dx: number
  dy: number
}

export interface BadgeBounds {
  /** Rightmost edge shifted badges may reach. The resting box is always kept. */
  right?: number
  /** Topmost edge shifted badges may reach. The resting box is always kept. */
  top?: number
}

/** Conservative badge box; the rendered width is 21–24px depending on digits. */
export const BADGE_WIDTH = 24
export const BADGE_HEIGHT = 15

const STEP_X = BADGE_WIDTH + 4
const STEP_Y = BADGE_HEIGHT + 3
/** Rest, then two steps right; after that the stack grows upward. */
const MAX_COLUMNS = 3
const MAX_ROWS = 24

function overlaps(a: BadgeAnchor, b: BadgeAnchor): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}

function fits(anchor: BadgeAnchor, dx: number, dy: number, bounds: BadgeBounds): boolean {
  if (dx > 0 && bounds.right !== undefined && anchor.x + dx + anchor.width > bounds.right) {
    return false
  }
  if (dy < 0 && bounds.top !== undefined && anchor.y + dy < bounds.top) {
    return false
  }
  return true
}

/**
 * Greedy placement in reading order. Each badge first tries its resting spot,
 * then shifts right a couple of badge widths, and finally stacks upward. The
 * resting spot is always returned when no candidate fits, so a badge never
 * disappears because of an edge.
 */
export function placeBadges(
  anchors: readonly BadgeAnchor[],
  bounds: BadgeBounds = {},
): BadgeOffset[] {
  const placed: BadgeAnchor[] = []
  return anchors.map((anchor) => {
    for (let row = 0; row < MAX_ROWS; row += 1) {
      for (let column = 0; column < MAX_COLUMNS; column += 1) {
        const dx = column * STEP_X
        const dy = row === 0 ? 0 : -row * STEP_Y
        if (!fits(anchor, dx, dy, bounds)) continue
        const candidate = { ...anchor, x: anchor.x + dx, y: anchor.y + dy }
        if (placed.some((box) => overlaps(candidate, box))) continue
        placed.push(candidate)
        return { dx, dy }
      }
    }
    placed.push(anchor)
    return { dx: 0, dy: 0 }
  })
}
