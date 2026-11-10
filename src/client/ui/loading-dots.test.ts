import { describe, expect, it } from 'vitest'
import { waveDelayA, waveDelayB } from './loading-dots.ts'

describe('wave delays', () => {
  it('starts the left focus earliest and the right focus half a period late', () => {
    const nearA = waveDelayA({ x: 9, y: 16 })
    const nearB = waveDelayB({ x: 23, y: 16 })
    expect(nearA).toBe(0)
    expect(nearB).toBe(900)
  })

  it('grows with distance from each focus', () => {
    expect(waveDelayA({ x: 20, y: 16 })).toBeGreaterThan(waveDelayA({ x: 9, y: 16 }))
    expect(waveDelayB({ x: 9, y: 16 })).toBeGreaterThan(waveDelayB({ x: 23, y: 16 }))
  })

  it('never goes negative', () => {
    for (const cell of [{ x: 0, y: 0 }, { x: 31, y: 31 }]) {
      expect(waveDelayA(cell)).toBeGreaterThanOrEqual(0)
      expect(waveDelayB(cell)).toBeGreaterThanOrEqual(0)
    }
  })
})
