import { describe, expect, it } from 'vitest'
import {
  BADGE_HEIGHT,
  BADGE_WIDTH,
  badgeContainsPoint,
  badgeHitBox,
  badgeWidth,
  placeBadges,
} from './badge-layout.ts'

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

describe('badge hit box', () => {
  const mark = { right: 200, bottom: 100 }

  it('grows with the digit count', () => {
    expect(badgeWidth(1)).toBe(15)
    expect(badgeWidth(12)).toBe(18)
    expect(badgeWidth(123)).toBe(24)
  })

  it('covers the painted badge and its collision offset', () => {
    const rest = badgeHitBox(mark, 1)
    expect(badgeContainsPoint(rest, 209, 84)).toBe(true)
    expect(badgeContainsPoint(rest, 190, 84)).toBe(false)
    const shifted = badgeHitBox(mark, 1, { dx: 28, dy: -18 })
    expect(badgeContainsPoint(shifted, 237, 66)).toBe(true)
  })

  it('rejects clicks on the marked prose', () => {
    const box = badgeHitBox(mark, 1)
    expect(badgeContainsPoint(box, 180, 95)).toBe(false)
    expect(badgeContainsPoint(box, 230, 95)).toBe(false)
  })
})
