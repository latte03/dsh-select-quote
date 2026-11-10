import { describe, expect, it } from 'vitest'
import { countDirection } from './summary-count.ts'

describe('countDirection', () => {
  it('reads an added annotation as a step up', () => {
    expect(countDirection(0, 1)).toBe('up')
    expect(countDirection(1, 2)).toBe('up')
    expect(countDirection(9, 10)).toBe('up')
  })

  it('reads a removed annotation as a step down', () => {
    expect(countDirection(1, 0)).toBe('down')
    expect(countDirection(3, 2)).toBe('down')
  })

  it('draws in place when the number did not move', () => {
    expect(countDirection(1, 1)).toBeNull()
    expect(countDirection(0, 0)).toBeNull()
  })
})
