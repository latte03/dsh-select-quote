/**
 * The breathing wave that runs through the count.
 *
 * There is no separate dot field any more: the count *is* the field. Its 5×7
 * glyph is already a grid, so while a turn runs every lit cell becomes a dot and
 * the wave travels through the strokes themselves — the number and the pulse are
 * one object instead of two layers.
 *
 * Pure timing: given a cell, how late does its pulse start. Two foci, half a
 * period apart, so the field breathes instead of rippling from one centre.
 */
export interface WaveCell {
  readonly x: number
  readonly y: number
}

/** One wave travels this many ms per pixel away from its focus. */
const PER_PX_MS = 42
/** The second focus runs half a period late, which is what makes it breathe. */
const PHASE_MS = 900

const focusA = { x: 9, y: 16 }
const focusB = { x: 23, y: 16 }

const distanceTo = (cell: WaveCell, focus: { x: number; y: number }): number => {
  const dx = cell.x - focus.x
  const dy = cell.y - focus.y
  return Math.sqrt(dx * dx + dy * dy)
}

/** Delay for the left focus. */
export function waveDelayA(cell: WaveCell): number {
  return Math.round(distanceTo(cell, focusA) * PER_PX_MS)
}

/** Delay for the right focus, half a period behind. */
export function waveDelayB(cell: WaveCell): number {
  return Math.round(distanceTo(cell, focusB) * PER_PX_MS) + PHASE_MS
}
