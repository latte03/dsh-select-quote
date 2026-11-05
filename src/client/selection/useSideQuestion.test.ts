import { beforeEach, describe, expect, it } from 'vitest'
import { clearAnnotations, getAnnotations, saveAnnotation } from '../state/annotation-store.ts'
import { consumeQuote } from './useSideQuestion.ts'

const SESSION = 'session-a'

function reset(): void {
  clearAnnotations(SESSION, 'discarded')
}

describe('consumeQuote', () => {
  beforeEach(reset)

  it('removes the pending card that stands for the sent quote', () => {
    const source = {
      text: '被引用的原文',
      messageId: 'flow-1',
      messageKind: 'user' as const,
      startOffset: 10,
      endOffset: 16,
    }
    const pending = saveAnnotation(SESSION, { text: '被引用的原文', sources: [source] })
    saveAnnotation(SESSION, { text: '另一段', sources: [{ text: '另一段' }] })
    expect(getAnnotations(SESSION)).toHaveLength(2)

    consumeQuote({ text: '被引用的原文', source }, SESSION)

    const left = getAnnotations(SESSION)
    expect(left).toHaveLength(1)
    expect(left[0]?.text).toBe('另一段')
    expect(left.some((item) => item.id === pending.id)).toBe(false)
  })

  it('keeps an annotation of the same text from a different message', () => {
    saveAnnotation(
      SESSION,
      {
        text: '重复的句子',
        sources: [
          {
            text: '重复的句子',
            messageId: 'flow-1',
            messageKind: 'user',
            startOffset: 0,
            endOffset: 5,
          },
        ],
      },
    )

    consumeQuote({
      text: '重复的句子',
      source: {
        messageId: 'flow-2',
        messageKind: 'user',
        startOffset: 0,
        endOffset: 5,
      },
    })

    expect(getAnnotations(SESSION)).toHaveLength(1)
  })

  it('falls back to text matching when the selection has no locator', () => {
    saveAnnotation(SESSION, { text: '没有定位的片段', sources: [{ text: '没有定位的片段' }] })

    consumeQuote({ text: '没有定位的片段' }, SESSION)

    expect(getAnnotations(SESSION)).toHaveLength(0)
  })

  it('leaves everything alone when nothing matches', () => {
    saveAnnotation(SESSION, { text: '保留我', sources: [{ text: '保留我' }] })

    consumeQuote({ text: '完全不同的文本' }, SESSION)

    expect(getAnnotations(SESSION)).toHaveLength(1)
  })
})
