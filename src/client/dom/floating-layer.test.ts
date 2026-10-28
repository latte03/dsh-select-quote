import { describe, expect, it } from 'vitest'
import { canHostFloatingLayer } from './floating-layer.ts'

describe('canHostFloatingLayer', () => {
  it('accepts the transcript scroller outside every flow item', () => {
    expect(canHostFloatingLayer('auto', false)).toBe(true)
    expect(canHostFloatingLayer('scroll', false)).toBe(true)
    expect(canHostFloatingLayer('overlay', false)).toBe(true)
  })

  it('ignores containers that do not scroll', () => {
    expect(canHostFloatingLayer('visible', false)).toBe(false)
    expect(canHostFloatingLayer('hidden', false)).toBe(false)
    expect(canHostFloatingLayer('clip', false)).toBe(false)
  })

  it('refuses a scroll container nested inside a flow item', () => {
    // The reasoning block: a capped, masked scroller wrapping a nested flow item.
    expect(canHostFloatingLayer('auto', true)).toBe(false)
    expect(canHostFloatingLayer('scroll', true)).toBe(false)
  })
})
