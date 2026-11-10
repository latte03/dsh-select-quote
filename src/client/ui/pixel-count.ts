/**
 * The count as a 5×7 dot matrix.
 *
 * The badge has 32px to play with, which is the wrong size for a font and the
 * right size for a grid of dots: at 5×7 the digits are the same shape the
 * terminal whale is drawn in, so the two can share one visual language instead
 * of a picture sitting next to a number.
 *
 * Everything here is geometry only — no colours, no React, no CSS. The view
 * decides how big the finished grid is drawn; this module decides what is lit.
 */
export interface PixelRun {
  readonly x: number
  readonly y: number
  readonly len: number
}

export interface PixelCount {
  readonly cols: number
  readonly rows: number
  /** Horizontal runs of lit cells, one entry per unbroken stretch. */
  readonly runs: readonly PixelRun[]
}

export const GLYPH_COLS = 5
export const GLYPH_ROWS = 7
/** One blank column between glyphs, or two digits read as one wide block. */
const GLYPH_GAP = 1

/**
 * Five-wide capitals, seven rows. Hand-set rather than derived from a font: a
 * dot matrix has no anti-aliasing to hide a mangled `8`, so each glyph is drawn
 * once and checked.
 */
const GLYPHS: Readonly<Record<string, readonly string[]>> = {
  '0': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
}

/** The rows of one glyph, or null for a character the matrix cannot draw. */
export function pixelGlyphOf(char: string): readonly string[] | null {
  return GLYPHS[char] ?? null
}

/**
 * Lay `text` out left to right.
 *
 * Null means "draw this the normal way": an empty string or any character
 * outside the matrix would otherwise come out as a hole in the middle of the
 * count, and a hole reads as a bug rather than as a fallback.
 */
export function pixelCountOf(text: string): PixelCount | null {
  if (text.length === 0) return null
  const glyphs: (readonly string[])[] = []
  for (const char of text) {
    const glyph = pixelGlyphOf(char)
    if (glyph === null) return null
    glyphs.push(glyph)
  }
  const cols = glyphs.length * GLYPH_COLS + (glyphs.length - 1) * GLYPH_GAP
  const runs: PixelRun[] = []
  glyphs.forEach((glyph, index) => {
    const offset = index * (GLYPH_COLS + GLYPH_GAP)
    glyph.forEach((row, y) => {
      let start = -1
      for (let x = 0; x <= row.length; x += 1) {
        const lit = row[x] === '#'
        if (lit && start < 0) start = x
        if (!lit && start >= 0) {
          runs.push({ x: offset + start, y, len: x - start })
          start = -1
        }
      }
    })
  })
  return { cols, rows: GLYPH_ROWS, runs }
}

/**
 * One `d` attribute for the whole grid.
 *
 * Runs, not cells: a digit is ~20 cells but ~13 runs, and each run is a single
 * `Mhvvz` rectangle in the path — one DOM node for the entire count instead of
 * ninety.
 */
export function pixelCountPath(count: PixelCount): string {
  return count.runs
    .map(({ x, y, len }) => `M${x} ${y}h${len}v1h-${len}z`)
    .join('')
}

/**
 * Thicken the strokes by one cell on each side.
 *
 * A 5×7 glyph drawn with 0.3 of a cell between dots reads thin, and the honest
 * fix is not a fatter dot (that closes the gaps again) but fatter *strokes*: the
 * same table, every lit run dilated by one cell. Two-digit counts keep their one
 * blank column, so the glyphs still read as separate.
 */
export function boldPixelCells(count: PixelCount): { readonly x: number; readonly y: number }[] {
  return count.runs.flatMap(({ x, y, len }) => {
    const from = Math.max(0, x - 1)
    const to = Math.min(count.cols - 1, x + len)
    return Array.from({ length: to - from + 1 }, (_, i) => ({ x: from + i, y }))
  })
}

/** One entry per lit cell — the digit as dots rather than as strokes. */
export function pixelCells(count: PixelCount): { readonly x: number; readonly y: number }[] {
  return count.runs.flatMap(({ x, y, len }) =>
    Array.from({ length: len }, (_, i) => ({ x: x + i, y })),
  )
}

/**
 * Scale the grid to sit inside `box`, keeping the dots square.
 *
 * Fractional on purpose: a single digit wants ~2.6px dots and three characters
 * want ~1.3px, and rounding to whole pixels would either overflow the tile or
 * leave a two-digit count floating in the middle of it.
 */
export function fitPixelCount(
  count: PixelCount,
  box: { readonly width: number; readonly height: number },
): { width: number; height: number } {
  const scale = Math.min(box.width / count.cols, box.height / count.rows)
  return { width: count.cols * scale, height: count.rows * scale }
}
