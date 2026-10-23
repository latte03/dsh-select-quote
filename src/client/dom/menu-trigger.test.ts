import { describe, expect, it } from 'vitest'
import { pointInRects, shouldOpenSelectionMenu } from './menu-trigger.ts'

const open = {
  defaultPrevented: false,
  contextMenuEnabled: true,
  touch: false,
  targetInTranscript: true,
  pointInSelection: true,
  hasSelection: true,
}

describe('shouldOpenSelectionMenu', () => {
  it('takes an unclaimed right-click aimed at a live selection', () => {
    expect(shouldOpenSelectionMenu(open)).toBe(true)
  })

  it.each([
    ['defaultPrevented', true],
    ['contextMenuEnabled', false],
    ['touch', true],
    ['targetInTranscript', false],
    ['pointInSelection', false],
    ['hasSelection', false],
  ] as const)('leaves the event alone when %s blocks it', (field, blocking) => {
    expect(shouldOpenSelectionMenu({ ...open, [field]: blocking })).toBe(false)
  })
})

describe('pointInRects', () => {
  const lines = [
    { left: 10, top: 10, right: 210, bottom: 30 },
    { left: 10, top: 30, right: 110, bottom: 50 },
  ]

  it('accepts a point on any line, including the 2px tolerance', () => {
    expect(pointInRects(200, 20, lines)).toBe(true)
    expect(pointInRects(100, 40, lines)).toBe(true)
    expect(pointInRects(212, 20, lines)).toBe(true)
  })

  it('rejects points in the empty right side of a short line', () => {
    expect(pointInRects(180, 40, lines)).toBe(false)
    expect(pointInRects(5, 20, lines)).toBe(false)
  })
})
