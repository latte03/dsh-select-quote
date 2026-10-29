import { describe, expect, it } from 'vitest'
import { toolbarHangsBelow } from './selection.ts'

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
