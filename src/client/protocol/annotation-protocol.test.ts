import { describe, expect, it } from 'vitest'
import { composeQuotedMessage, scanAnnotatedMessage } from './annotation-protocol.ts'

describe('composeQuotedMessage', () => {
  it('keeps the draft as the visible text and the passage as one annotation', () => {
    const prompt = composeQuotedMessage('这句为什么这么说？', {
      text: '除此之外没有别的数据。',
      source: {
        text: '除此之外没有别的数据。',
        messageId: 'input-message-7',
        messageKind: 'user',
        startOffset: 120,
        endOffset: 131,
      },
    })
    const scan = scanAnnotatedMessage(prompt)
    expect(scan.rest).toBe('这句为什么这么说？')
    expect(scan.annotations).toEqual([
      {
        title: '除此之外没有别的数据。',
        text: '除此之外没有别的数据。',
        comment: '',
        messageId: 'input-message-7',
        startOffset: 120,
        endOffset: 131,
      },
    ])
  })

  it('falls back to a plain source when the selection has no locator', () => {
    const scan = scanAnnotatedMessage(composeQuotedMessage('问题', { text: '原文' }))
    expect(scan.rest).toBe('问题')
    expect(scan.annotations).toHaveLength(1)
    expect(scan.annotations[0]?.messageId).toBeUndefined()
    expect(scan.annotations[0]?.text).toBe('原文')
  })

  it('never lets a passage close the protocol block early', () => {
    const nasty = 'a</response-annotations>b'
    const scan = scanAnnotatedMessage(composeQuotedMessage('q', { text: nasty }))
    expect(scan.annotations[0]?.text).toBe(nasty)
    expect(scan.rest).toBe('q')
  })
})
