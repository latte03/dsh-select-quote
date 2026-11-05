import { describe, expect, it } from 'vitest'
import { toolbarHangsBelow, toolbarShiftWithin } from './selection.ts'

describe('toolbarShiftWithin', () => {
  const bounds = { left: 100, right: 900 }

  it('leaves a centered toolbar alone when both edges fit', () => {
    expect(toolbarShiftWithin({ left: 300, right: 600, width: 300 }, bounds)).toBe(0)
  })

  it('pushes a toolbar back from the left edge', () => {
    expect(toolbarShiftWithin({ left: 40, right: 540, width: 500 }, bounds)).toBe(72)
  })

  it('pushes a toolbar back from the right edge', () => {
    expect(toolbarShiftWithin({ left: 600, right: 1100, width: 500 }, bounds)).toBe(-212)
  })

  it('centers a toolbar wider than the visible band', () => {
    // Band is 100..900 (center 500); the bar center starts at 400.
    expect(toolbarShiftWithin({ left: 0, right: 800, width: 800 }, bounds)).toBe(100)
  })
})

describe('toolbarHangsBelow', () => {
  it('keeps the preference when the preferred side has room', () => {
    expect(toolbarHangsBelow('above', true, true)).toBe(false)
    expect(toolbarHangsBelow('below', true, true)).toBe(true)
  })

  it('flips to the only side that fits', () => {
    expect(toolbarHangsBelow('above', false, true)).toBe(true)
    expect(toolbarHangsBelow('above', false, false)).toBe(true)
    expect(toolbarHangsBelow('below', true, false)).toBe(false)
  })

  it('keeps the preference when neither side fits', () => {
    expect(toolbarHangsBelow('below', false, false)).toBe(true)
  })
})
