import { describe, expect, it } from 'vitest'
import { placeTip } from './tip-placement.ts'

const bounds = { top: 0, left: 0, right: 1000, bottom: 800 }
const size = { width: 90, height: 24 }

describe('placeTip', () => {
  it('centres the tip above the button', () => {
    const out = placeTip({ top: 400, left: 300, width: 30, height: 30 }, size, bounds)
    expect(out.side).toBe('top')
    expect(out.top).toBe(400 - 24 - 8)
    expect(out.left).toBe(300 + 15 - 45)
  })

  it('keeps the tip inside the viewport near an edge', () => {
    const left = placeTip({ top: 400, left: 4, width: 30, height: 30 }, size, bounds)
    expect(left.left).toBe(8)
    const right = placeTip({ top: 400, left: 980, width: 30, height: 30 }, size, bounds)
    expect(right.left).toBe(1000 - 90 - 8)
  })

  it('drops below when there is no room above', () => {
    const out = placeTip({ top: 10, left: 300, width: 30, height: 30 }, size, bounds)
    expect(out.side).toBe('bottom')
    expect(out.top).toBe(10 + 30 + 8)
  })

  it('stays above when the room is roughly equal', () => {
    const out = placeTip({ top: 400, left: 300, width: 30, height: 30 }, size, {
      top: 0,
      left: 0,
      right: 1000,
      bottom: 830,
    })
    expect(out.side).toBe('top')
  })

  it('clamps inside a viewport shorter than the tip needs', () => {
    const out = placeTip({ top: 20, left: 300, width: 30, height: 30 }, size, {
      top: 0,
      left: 0,
      right: 1000,
      bottom: 60,
    })
    expect(out.top).toBe(8)
  })
})
