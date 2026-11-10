import { describe, expect, it } from 'vitest'
import { shouldCompactRow } from './host-surface-fit.ts'

describe('shouldCompactRow', () => {
  it('keeps the labels when the row fits the column', () => {
    expect(shouldCompactRow(320, 800)).toBe(false)
    expect(shouldCompactRow(320, 328)).toBe(false)
  })

  it('drops them when the row is wider than the column', () => {
    expect(shouldCompactRow(320, 240)).toBe(true)
    expect(shouldCompactRow(320, 319)).toBe(true)
  })

  it('never collapses on an unmeasured width', () => {
    // A zero column (hidden pane) or a zero row (not laid out yet) used to fall
    // into a floor value and stick at icons forever.
    expect(shouldCompactRow(0, 800)).toBe(false)
    expect(shouldCompactRow(320, 0)).toBe(false)
    expect(shouldCompactRow(0, 0)).toBe(false)
    expect(shouldCompactRow(Number.NaN, 800)).toBe(false)
  })
})
