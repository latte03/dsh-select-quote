import { describe, expect, it } from 'vitest'
import type { OutboundAnnotation } from './handoff.ts'
import {
  groupHandoffs,
  handoffMarkId,
  handoffMarkIdOf,
  newHandoffId,
  selectionKeyOf,
  stableHash,
} from './handoff.ts'

function record(
  id: string,
  destination: string,
  selectionKey: string,
  at: number,
): OutboundAnnotation {
  return {
    id,
    text: '同一段文字',
    sources: [{ text: '同一段文字', messageId: 'flow-1', startOffset: 3, endOffset: 9 }],
    selectionKey,
    destination: { sessionId: destination, kind: 'existing', title: destination },
    state: 'pending',
    createdAt: at,
    updatedAt: at,
  }
}

const source = { text: '同一段文字', messageId: 'flow-1', startOffset: 3, endOffset: 9 }

describe('selectionKeyOf', () => {
  it('is stable for the same span and spreads across different ones', () => {
    expect(selectionKeyOf('同一段文字', source)).toBe(selectionKeyOf('同一段文字', { ...source }))
    expect(selectionKeyOf('同一段文字', { ...source, startOffset: 4 })).not.toBe(
      selectionKeyOf('同一段文字', source),
    )
    expect(selectionKeyOf('同一段文字', { ...source, messageId: 'flow-2' })).not.toBe(
      selectionKeyOf('同一段文字', source),
    )
  })

  it('falls back to the text alone without a locator', () => {
    expect(selectionKeyOf('只有文字')).toBe('只有文字\u0000')
  })
})

describe('mark identity', () => {
  it('derives a stable out_ mark id per selection key', () => {
    const key = selectionKeyOf('同一段文字', source)
    expect(handoffMarkId(key)).toBe(`out_${stableHash(key)}`)
    expect(handoffMarkId(key)).toBe(handoffMarkId(key))
    expect(newHandoffId(key).startsWith(`${handoffMarkId(key)}_`)).toBe(true)
  })

  it('recovers the mark id from an outbound record id', () => {
    const key = selectionKeyOf('同一段文字', source)
    expect(handoffMarkIdOf(newHandoffId(key))).toBe(handoffMarkId(key))
    expect(handoffMarkIdOf(handoffMarkId(key))).toBe(handoffMarkId(key))
    expect(handoffMarkIdOf('')).toBe('')
  })
})

describe('groupHandoffs', () => {
  it('merges targets of one selection into a single mark', () => {
    const key = selectionKeyOf('同一段文字', source)
    const groups = groupHandoffs([
      record('out_a_1', 'target-a', key, 1),
      record('out_a_2', 'target-b', key, 2),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.markId).toBe(handoffMarkId(key))
    expect(groups[0]?.records.map((entry) => entry.destination.sessionId)).toEqual([
      'target-a',
      'target-b',
    ])
    // The job key carries the locator of the first record.
    expect(groups[0]?.messageId).toBe('flow-1')
    expect(groups[0]?.startOffset).toBe(3)
    expect(groups[0]?.endOffset).toBe(9)
  })

  it('never merges different selections that happen to share the text', () => {
    const first = record('out_a_1', 'target-a', selectionKeyOf('同一段文字', source), 1)
    const second = record(
      'out_a_2',
      'target-b',
      selectionKeyOf('同一段文字', { ...source, startOffset: 40, endOffset: 46 }),
      2,
    )
    expect(groupHandoffs([first, second])).toHaveLength(2)
  })
})
