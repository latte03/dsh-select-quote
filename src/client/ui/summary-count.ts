/**
 * Which way the badge arrives when the count moves.
 *
 * The card's badge is a counter, not an ornament, so it holds still until the
 * number itself changes — and then the direction is the whole message: a digit
 * dropping in from above is what makes a delete read as a delete, and one
 * rising from below is what makes an added annotation read as added. Same
 * number, same card, and the eye still knows which way it went.
 *
 * `null` means "nothing moved, draw it in place": first mount, or a re-render
 * for some other reason. Animating those would turn a static count into
 * decoration.
 */
export type CountDirection = 'up' | 'down'

export function countDirection(previous: number, next: number): CountDirection | null {
  if (next === previous) return null
  return next > previous ? 'up' : 'down'
}
