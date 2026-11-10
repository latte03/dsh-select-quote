/**
 * Decide whether a merged action row has to drop its labels.
 *
 * Split out of the view because the measurement is exactly where the merged
 * surface went wrong: the Host wraps the row in an absolutely positioned
 * `width: max-content` box, so reading "available width" from that box returns
 * the row's own width and the comparison is *always* true. Every merged row
 * collapsed to icons at every column width. The caller must pass the width of
 * the box that really constrains the surface — the Chat column it is positioned
 * in.
 *
 * A non-positive number means "not measured yet" (a hidden pane, a surface
 * mounted before layout). Deciding on it would collapse the row permanently, so
 * an unknown measurement keeps the labels and asks again next tick.
 */
export function shouldCompactRow(naturalWidth: number, availableWidth: number): boolean {
  if (!(naturalWidth > 0) || !(availableWidth > 0)) return false
  return naturalWidth > availableWidth
}
