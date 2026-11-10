import { describe, expect, it } from 'vitest'
import {
  fitPixelCount,
  GLYPH_COLS,
  GLYPH_ROWS,
  pixelCountOf,
  pixelCountPath,
  pixelGlyphOf,
} from './pixel-count.ts'

describe('pixelGlyphOf', () => {
  it('draws every digit the matrix has to carry', () => {
    for (const char of '0123456789+') {
      const glyph = pixelGlyphOf(char)
      expect(glyph, char).not.toBeNull()
      expect(glyph).toHaveLength(GLYPH_ROWS)
      for (const row of glyph ?? []) expect(row).toHaveLength(GLYPH_COLS)
    }
  })

  it('has no glyph for anything else', () => {
    // A hole in the middle of a count reads as a bug, so unknown characters
    // have to be rejected rather than drawn as blank cells.
    expect(pixelGlyphOf('a')).toBeNull()
    expect(pixelGlyphOf(' ')).toBeNull()
  })

  it('gives each digit a distinct pattern', () => {
    const seen = new Set('0123456789'.split('').map((c) => (pixelGlyphOf(c) ?? []).join('')))
    expect(seen.size).toBe(10)
  })
})

describe('pixelCountOf', () => {
  it('lays two digits one blank column apart', () => {
    const count = pixelCountOf('12')
    expect(count).not.toBeNull()
    expect(count?.cols).toBe(GLYPH_COLS * 2 + 1)
    expect(count?.rows).toBe(GLYPH_ROWS)
  })

  it('merges lit cells into runs instead of emitting one per cell', () => {
    // "1" is one run per row at most, "8" is two: the point is that a digit
    // costs a handful of path commands, not thirty-five rectangles.
    const one = pixelCountOf('1')
    const eight = pixelCountOf('8')
    expect(one?.runs.length).toBeLessThanOrEqual(GLYPH_ROWS)
    expect(eight?.runs.length).toBeGreaterThan(one?.runs.length ?? 0)
    expect(eight?.runs.every((run) => run.len >= 1)).toBe(true)
  })

  it('refuses text the matrix cannot draw', () => {
    expect(pixelCountOf('')).toBeNull()
    expect(pixelCountOf('1x')).toBeNull()
  })
})

describe('pixelCountPath', () => {
  it('writes one closed rectangle per run', () => {
    const count = pixelCountOf('5')
    const path = pixelCountPath(count!)
    expect(path.match(/M/g)).toHaveLength(count!.runs.length)
    expect(path).not.toContain('NaN')
    expect(path.startsWith('M')).toBe(true)
  })
})

describe('fitPixelCount', () => {
  const box = { width: 22, height: 18 }

  it('fits one digit by height', () => {
    const fitted = fitPixelCount(pixelCountOf('1')!, box)
    expect(fitted.height).toBeCloseTo(18, 5)
    expect(fitted.width).toBeLessThan(box.width)
  })

  it('fits three characters by width', () => {
    const fitted = fitPixelCount(pixelCountOf('99+')!, box)
    expect(fitted.width).toBeCloseTo(box.width, 5)
    expect(fitted.height).toBeLessThan(box.height)
  })

  it('never exceeds either side of the box', () => {
    for (const text of ['1', '10', '100']) {
      const fitted = fitPixelCount(pixelCountOf(text)!, box)
      expect(fitted.width).toBeLessThanOrEqual(box.width + 1e-9)
      expect(fitted.height).toBeLessThanOrEqual(box.height + 1e-9)
    }
  })
})
