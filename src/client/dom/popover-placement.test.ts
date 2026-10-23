import { describe, expect, it } from 'vitest'
import { placePopover } from './popoverPlacement.ts'

const bounds = { left: 0, top: 0, right: 1000, bottom: 800 }
const panel = { width: 300, height: 200 }
const rect = (left: number, top: number, width = 40, height = 20): DOMRect =>
  ({
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  }) as DOMRect

describe('placePopover', () => {
  it('prefers the requested side when it fits', () => {
    const result = placePopover(rect(100, 300), panel, 'bottom', 8, bounds)
    expect(result).toEqual({ top: 328, left: 100, side: 'bottom' })
  })

  it('flips when the preferred side has less room', () => {
    const result = placePopover(rect(100, 700), panel, 'bottom', 8, bounds)
    expect(result.side).toBe('top')
    expect(result.top).toBe(492)
  })

  it('clamps the left edge inside the bounds', () => {
    expect(placePopover(rect(980, 300), panel, 'bottom', 8, bounds).left).toBe(692)
    expect(placePopover(rect(-20, 300), panel, 'bottom', 8, bounds).left).toBe(8)
  })
})
