import { describe, expect, it } from 'vitest'
import type { ParsedAnnotation } from '../protocol/annotation-protocol.ts'
import { messageQuotes, registerMessageQuotes } from './quote-registry.ts'

const quotes = (text: string): readonly ParsedAnnotation[] => [
  { text } as ParsedAnnotation,
]

describe('registerMessageQuotes', () => {
  it('removes its own entry on unmount', () => {
    const dispose = registerMessageQuotes('flow-unmount', quotes('原文'))
    expect(messageQuotes('flow-unmount')?.[0]?.text).toBe('原文')
    dispose()
    expect(messageQuotes('flow-unmount')).toBeUndefined()
  })

  it('does not remove an entry a newer mount registered', () => {
    const stale = registerMessageQuotes('flow-remount', quotes('旧'))
    const current = registerMessageQuotes('flow-remount', quotes('新'))
    stale()
    expect(messageQuotes('flow-remount')?.[0]?.text).toBe('新')
    current()
    expect(messageQuotes('flow-remount')).toBeUndefined()
  })

  it('keeps side-question quotes after the sidebar unmounts', () => {
    // The robot badge is painted in the parent transcript; closing the sidebar
    // unmounts the card, and the badge must still resolve its quote.
    const dispose = registerMessageQuotes('flow-side-question', quotes('侧边引用'), {
      retainWhenUnmounted: true,
    })
    dispose()
    expect(messageQuotes('flow-side-question')?.[0]?.text).toBe('侧边引用')
  })
})
