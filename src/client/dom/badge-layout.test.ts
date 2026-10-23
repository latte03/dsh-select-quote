import { describe, expect, it } from 'vitest'
import { BADGE_HEIGHT, BADGE_WIDTH, placeBadges } from './badge-layout.ts'

const anchor = (x: number, y: number) => ({ x, y, width: BADGE_WIDTH, height: BADGE_HEIGHT })

describe('placeBadges', () => {
  it('keeps the exported box at the paint size', () => {
    expect(BADGE_HEIGHT).toBe(15)
    expect(BADGE_WIDTH).toBeGreaterThanOrEqual(15)
  })

  it('leaves a single badge at its resting spot', () => {
    expect(placeBadges([anchor(10, 10)])).toEqual([{ dx: 0, dy: 0 }])
  })

  it('spreads two and three badges that end at the same pixel', () => {
    expect(placeBadges([anchor(10, 10), anchor(10, 10)])).toEqual([
      { dx: 0, dy: 0 },
      { dx: 28, dy: 0 },
    ])
    expect(placeBadges([anchor(10, 10), anchor(10, 10), anchor(10, 10)])).toEqual([
      { dx: 0, dy: 0 },
      { dx: 28, dy: 0 },
      { dx: 56, dy: 0 },
    ])
  })

  it('stacks the fourth badge upward', () => {
    expect(
      placeBadges([anchor(10, 10), anchor(10, 10), anchor(10, 10), anchor(10, 10)]),
    ).toEqual([
      { dx: 0, dy: 0 },
      { dx: 28, dy: 0 },
      { dx: 56, dy: 0 },
      { dx: 0, dy: -18 },
    ])
  })

  it('does not move badges that are already apart', () => {
    expect(placeBadges([anchor(10, 10), anchor(200, 10)])).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
    ])
    expect(placeBadges([anchor(10, 10), anchor(10, 40)])).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
    ])
  })

  it('stacks instead of crossing the right edge', () => {
    expect(placeBadges([anchor(10, 10), anchor(10, 10)], { right: 50 })).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: -18 },
    ])
  })

  it('falls back to the resting spot when there is no room', () => {
    expect(placeBadges([anchor(10, 10), anchor(10, 10)], { right: 0, top: 1000 })).toEqual([
      { dx: 0, dy: 0 },
      { dx: 0, dy: 0 },
    ])
  })
})
